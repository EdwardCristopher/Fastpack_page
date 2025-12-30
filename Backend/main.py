from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

# Importamos las aplicaciones que ya tienes definidas
# Asegúrate de que los archivos se llamen auth.py y app.py dentro de Backend
from Backend.auth import auth_app
from Backend.app import app as converter_app

# Creamos la aplicación maestra
main_app = FastAPI(title="Fastpack Portal Unificado")

# Configuración Global de CORS (Crucial para que el navegador no bloquee las peticiones)
main_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"]
)

# Servir archivos estáticos (manuales y videos)
# Usamos una ruta absoluta para evitar errores en el servidor
assets_path = os.path.join(os.getcwd(), "assets")
if os.path.exists(assets_path):
    main_app.mount("/assets", StaticFiles(directory="assets"), name="assets")

# --- MONTAR SUB-APLICACIONES ---

# 1. Rutas de Autenticación, Usuarios y Base de Datos (Antes puerto 8001)
main_app.mount("/api/auth", auth_app)

# 2. Rutas del Convertidor de PDF/Word (Antes puerto 8000)
main_app.mount("/api/converter", converter_app)

@main_app.get("/")
async def status():
    return {
        "status": "Online",
        "message": "Sistema Fastpack operando correctamente",
        "endpoints": ["/api/auth", "/api/converter"]
    }

if __name__ == "__main__":
    import uvicorn
    # Railway asigna el puerto automáticamente
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(main_app, host="0.0.0.0", port=port)