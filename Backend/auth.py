from fastapi import FastAPI, HTTPException, Depends, Header, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import shutil
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime
from typing import Optional, List

# 1. CARGA DEL .env
env_path = Path('.') / '.env'
load_dotenv(dotenv_path=env_path, encoding='utf-8')

auth_app = FastAPI()

# --- CONFIGURACIÓN DE SEGURIDAD ROOT ---
SUPER_ADMINS = ["amureira", "sgomez", "sbasai"]

# --- CONFIGURACIÓN PARA SERVIR VIDEOS Y DOCUMENTOS ---
auth_app.mount("/assets", StaticFiles(directory="assets"), name="assets")

auth_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Definir la ruta física donde se guardarán los archivos
UPLOAD_DIR = Path("assets/docs")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# --- MODELOS DE DATOS ---
class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    token: str
    rol: str = "practicante"
    nombre: str = ""

class UserUpdateRequest(BaseModel):
    nombre: str
    password: Optional[str] = None
    perm_upload: bool
    perm_suppliers: bool
    perm_update: bool
    perm_delete: bool
    perm_convertir: bool
    perm_renombrar: bool
    operador_id: str

# Modelo para actualizar la información del manual
class TutorialUpdate(BaseModel):
    titulo: str
    descripcion: str

# --- CONEXIÓN A DB ---
def get_db_connection():
    try:
        return psycopg2.connect(
            host=os.getenv("DB_HOST"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            port=os.getenv("DB_PORT")
        )
    except Exception as e:
        print(f"Error de conexión: {e}")
        raise HTTPException(status_code=500, detail="Error de conexión a la DB")

def registrar_log(cur, usuario_id, accion):
    query = "INSERT INTO historial_cambios (usuario_id, accion, fecha) VALUES (%s, %s, %s)"
    cur.execute(query, (usuario_id, accion, datetime.now()))

# --- RUTAS DE ACCESO ---

@auth_app.post("/login")
async def login(credentials: LoginRequest):
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        query = """
            SELECT id, username, rol, nombre, 
                   perm_upload, perm_suppliers, perm_update, perm_delete, 
                   perm_convertir, perm_renombrar 
            FROM usuarios WHERE username = %s AND password = %s
        """
        cur.execute(query, (credentials.username.lower(), credentials.password))
        user = cur.fetchone()
        
        if user:
            cur.execute("UPDATE usuarios SET ultimo_acceso = %s WHERE id = %s", (datetime.now(), user['id']))
            registrar_log(cur, user['id'], "Inicio de sesión")
            conn.commit()
            return {
                "success": True, 
                "user": user['username'], 
                "rol": user['rol'], 
                "nombre": user['nombre'],
                "permisos": user
            }
        else:
            raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    finally:
        if conn: conn.close()

# --- RUTA DE REGISTRO DE USUARIOS ---
@auth_app.post("/register")
async def register(user: RegisterRequest):
    if user.token != "FP2025":
        raise HTTPException(status_code=403, detail="Token de registro inválido")
    
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Verificar si el usuario ya existe
        cur.execute("SELECT id FROM usuarios WHERE username = %s", (user.username.lower(),))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="El nombre de usuario ya está registrado")
        
        query = """
            INSERT INTO usuarios (username, password, rol, nombre, creado_en) 
            VALUES (%s, %s, %s, %s, %s) RETURNING id
        """
        cur.execute(query, (user.username.lower(), user.password, user.rol, user.nombre, datetime.now()))
        new_user_id = cur.fetchone()[0]
        
        registrar_log(cur, new_user_id, "Registro de cuenta nueva")
        conn.commit()
        return {"success": True, "message": "Usuario creado con éxito"}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        print(f"Error en registro: {e}")
        raise HTTPException(status_code=500, detail="Error interno al registrar usuario")
    finally:
        if conn: conn.close()

# --- RUTAS DE MANUALES (TUTORIALES) ---

@auth_app.get("/tutoriales")
async def obtener_tutoriales():
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT id, titulo, descripcion, enlace, categoria, tipo FROM tutoriales ORDER BY id DESC")
        return cur.fetchall()
    except Exception as e:
        print(f"Error al obtener tutoriales: {e}")
        return []
    finally:
        if conn: conn.close()

@auth_app.post("/tutorial/upload")
async def subir_tutorial(
    titulo: str = Form(...),
    descripcion: str = Form(...),
    categoria: str = Form(...),
    username_autor: str = Form(...),
    file: UploadFile = File(...)
):
    conn = None
    try:
        # 1. Guardar el archivo físicamente en el disco
        file_path = UPLOAD_DIR / file.filename
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 2. Detectar tipo automáticamente
        enlace = file.filename
        tipo_detectado = "video" if enlace.lower().endswith('.mp4') else "archivo"

        # 3. Conectar a DB para registrar el tutorial
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("SELECT id FROM usuarios WHERE username = %s", (username_autor.lower(),))
        res = cur.fetchone()
        user_id = res[0] if res else None

        query = """
            INSERT INTO tutoriales (titulo, descripcion, enlace, categoria, tipo, usuario_id)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        cur.execute(query, (titulo, descripcion, enlace, categoria, tipo_detectado, user_id))
        
        if user_id:
            registrar_log(cur, user_id, f"Subió manual: {file.filename}")
            
        conn.commit()
        return {"success": True, "message": "Archivo subido y registrado correctamente"}
    except Exception as e:
        print(f"Error en la subida: {e}")
        raise HTTPException(status_code=500, detail=f"Error al procesar el archivo: {str(e)}")
    finally:
        if conn: conn.close()

# RUTA PARA ACTUALIZAR INFORMACIÓN DE MANUALES
@auth_app.put("/tutorial/update-info/{tuto_id}")
async def actualizar_info_tutorial(tuto_id: int, data: TutorialUpdate):
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Ejecutamos la actualización en la tabla tutoriales
        query = "UPDATE tutoriales SET titulo = %s, descripcion = %s WHERE id = %s"
        cur.execute(query, (data.titulo, data.descripcion, tuto_id))
        
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Manual no encontrado")
            
        conn.commit()
        return {"success": True, "message": "Manual actualizado"}
    except Exception as e:
        print(f"Error en update: {e}")
        raise HTTPException(status_code=500, detail="Error interno al actualizar manual")
    finally:
        if conn: conn.close()

@auth_app.delete("/tutorial/delete/{tuto_id}")
async def eliminar_tutorial(tuto_id: int):
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM tutoriales WHERE id = %s", (tuto_id,))
        conn.commit()
        return {"success": True, "message": "Manual eliminado"}
    finally:
        if conn: conn.close()

# --- RUTAS ADMINISTRATIVAS ---

@auth_app.put("/admin/usuario/update/{user_id}")
async def actualizar_usuario(user_id: int, data: UserUpdateRequest):
    if data.operador_id.lower() not in SUPER_ADMINS:
        raise HTTPException(status_code=403, detail="Acceso denegado")

    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT rol FROM usuarios WHERE id = %s", (user_id,))
        usuario_destino = cur.fetchone()
        
        final_perm_suppliers = data.perm_suppliers
        if usuario_destino and usuario_destino[0] == "practicante":
            final_perm_suppliers = False 

        if data.password and data.password.strip() != "":
            query = """
                UPDATE usuarios SET nombre = %s, password = %s, perm_upload = %s, 
                perm_suppliers = %s, perm_update = %s, perm_delete = %s,
                perm_convertir = %s, perm_renombrar = %s
                WHERE id = %s
            """
            params = (data.nombre, data.password, data.perm_upload, final_perm_suppliers, 
                      data.perm_update, data.perm_delete, data.perm_convertir, 
                      data.perm_renombrar, user_id)
        else:
            query = """
                UPDATE usuarios SET nombre = %s, perm_upload = %s, 
                perm_suppliers = %s, perm_update = %s, perm_delete = %s,
                perm_convertir = %s, perm_renombrar = %s
                WHERE id = %s
            """
            params = (data.nombre, data.perm_upload, final_perm_suppliers, data.perm_update, 
                      data.perm_delete, data.perm_convertir, data.perm_renombrar, user_id)
            
        cur.execute(query, params)
        conn.commit()
        return {"success": True, "nuevo_nombre": data.nombre}
    finally:
        if conn: conn.close()

@auth_app.delete("/admin/usuario/delete/{user_id}/{operador_id}")
async def eliminar_usuario(user_id: int, operador_id: str):
    if operador_id.lower() not in SUPER_ADMINS:
        raise HTTPException(status_code=403, detail="Sin permisos")

    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        registrar_log(cur, user_id, f"Perfil eliminado por: {operador_id}")
        cur.execute("DELETE FROM usuarios WHERE id = %s", (user_id,))
        conn.commit()
        return {"success": True, "message": "Usuario eliminado"}
    finally:
        if conn: conn.close()

@auth_app.get("/admin/usuarios")
async def listar_usuarios():
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT id, nombre, username, rol, creado_en, ultimo_acceso, perm_upload, perm_suppliers, perm_update, perm_delete, perm_convertir, perm_renombrar FROM usuarios ORDER BY creado_en DESC")
        return cur.fetchall()
    finally:
        if conn: conn.close()

@auth_app.get("/admin/historial")
async def obtener_historial():
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT u.nombre as usuario_nombre, h.accion, h.fecha 
            FROM historial_cambios h
            LEFT JOIN usuarios u ON h.usuario_id = u.id
            ORDER BY h.fecha DESC LIMIT 50
        """)
        return cur.fetchall()
    finally:
        if conn: conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(auth_app, host="0.0.0.0", port=8001)