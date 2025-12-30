// CONFIGURACIÓN
const AUTH_API_URL = "http://localhost:8001";
const ADMIN_TOKEN_SECRET = "FP2025"; 

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const btnToggle = document.getElementById('btnToggleRegister');
    const regSection = document.getElementById('registerSection');
    const btnConfirmRegister = document.getElementById('btnConfirmRegister');

    // 1. MANEJO DE INICIO DE SESIÓN
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('errorMessage');

        try {
            const response = await fetch(`${AUTH_API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                localStorage.setItem('fastpack_user', data.user);
                localStorage.setItem('fastpack_rol', data.rol);
                localStorage.setItem('fastpack_nombre', data.nombre || data.user);
                
                if (data.permisos) {
                    localStorage.setItem('perm_upload', data.permisos.perm_upload);
                    localStorage.setItem('perm_suppliers', data.permisos.perm_suppliers);
                    localStorage.setItem('perm_update', data.permisos.perm_update);
                    localStorage.setItem('perm_delete', data.permisos.perm_delete);
                    localStorage.setItem('perm_convertir', data.permisos.perm_convertir);
                    localStorage.setItem('perm_renombrar', data.permisos.perm_renombrar);
                }

                localStorage.setItem('fastpack_last_access', new Date().toISOString());
                window.location.href = 'index.html'; 
            } else {
                errorDiv.classList.remove('hidden');
                setTimeout(() => errorDiv.classList.add('hidden'), 3000);
            }
        } catch (error) {
            console.error("Error de conexión:", error);
            // Alerta de error de conexión mejorada
            Swal.fire({
                title: 'ERROR DE SISTEMA',
                text: 'No se pudo conectar con el servidor de autenticación (Puerto 8001).',
                icon: 'error',
                confirmButtonColor: '#0f172a'
            });
        }
    });

    // 2. ANIMACIÓN DEL PANEL DE REGISTRO
    btnToggle?.addEventListener('click', () => {
        if (regSection.classList.contains('hidden')) {
            regSection.classList.remove('hidden');
            setTimeout(() => {
                regSection.style.transform = "translateX(0) scale(1)";
                regSection.style.opacity = "1";
            }, 10);
        } else {
            regSection.style.transform = "translateX(-20px) scale(0.95)";
            regSection.style.opacity = "0";
            setTimeout(() => {
                regSection.classList.add('hidden');
            }, 400);
        }
    });

    const setupValidation = (inputId, checkId) => {
        document.getElementById(inputId)?.addEventListener('input', (e) => {
            const check = document.getElementById(checkId);
            if (e.target.value.length >= 4) {
                check.classList.remove('hidden');
            } else {
                check.classList.add('hidden');
            }
        });
    };

    setupValidation('username', 'userCheck');
    setupValidation('password', 'passCheck');

    btnConfirmRegister?.addEventListener('click', handleRegister);
});

// 5. FUNCIÓN PARA CREAR USUARIO (CON ESTILO MEJORADO)
async function handleRegister() {
    const token = document.getElementById('regToken').value;
    const username = document.getElementById('newUsername').value;
    const password = document.getElementById('newPassword').value;
    const rol = document.getElementById('newRol').value;

    if (token !== ADMIN_TOKEN_SECRET) {
        Swal.fire({
            title: 'TOKEN INVÁLIDO',
            text: 'El código de seguridad de administrador es incorrecto.',
            icon: 'warning',
            confirmButtonColor: '#0f172a'
        });
        return;
    }

    if (!username || !password) {
        Swal.fire({
            text: 'Por favor, complete todos los campos de registro.',
            icon: 'info',
            confirmButtonColor: '#0f172a'
        });
        return;
    }

    try {
        const response = await fetch(`${AUTH_API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username: username, 
                password: password, 
                token: token, 
                rol: rol,
                nombre: username 
            })
        });

        if (response.ok) {
            // ALERTA DE ÉXITO ESTILIZADA
            Swal.fire({
                title: '¡REGISTRO EXITOSO!',
                html: `Usuario <b>${username}</b> creado correctamente como <b>${rol}</b>.`,
                icon: 'success',
                confirmButtonColor: '#0f172a',
                confirmButtonText: 'CONTINUAR'
            }).then(() => {
                location.reload(); 
            });
        } else {
            const err = await response.json();
            Swal.fire({
                title: 'ERROR',
                text: err.detail || "No se pudo completar el registro.",
                icon: 'error',
                confirmButtonColor: '#0f172a'
            });
        }
    } catch (error) {
        console.error("Error:", error);
        Swal.fire({
            title: 'ERROR DE SERVIDOR',
            text: 'Fallo al conectar con auth.py.',
            icon: 'error',
            confirmButtonColor: '#0f172a'
        });
    }
}