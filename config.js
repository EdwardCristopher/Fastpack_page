// --- DATOS INICIALES Y CONFIGURACIÓN ---
const tutorialesBase = [
    { id: 101, titulo: "Creación de Usuario", descripcion: "Manual para registro de usuarios en dominio Fastpack.", enlace: "Creación_de_usuario.docx", categoria: "Sistemas", tipo: "archivo" },
    { id: 102, titulo: "Autodesk Desktop Connector", descripcion: "Guía de instalación desde web Autodesk.", enlace: "Instalación_autodesk_desktop_connector.docx", categoria: "Ingeniería", tipo: "archivo" },
    { id: 103, titulo: "Spoolgen e ISL", descripcion: "Instalación de componentes Spoolgen y licencias ISL.", enlace: "instalación_de_spoolgen_y_ISL.docx", categoria: "Sistemas", tipo: "archivo" },
    { id: 104, titulo: "Configuración BEAS", descripcion: "Parámetros necesarios para módulo BEAS.", enlace: "Instalación_y_configuración_BEAS.docx", categoria: "Sistemas", tipo: "archivo" },
    { id: 105, titulo: "Paso a paso Aplicaciones", descripcion: "Listado de software corporativo e instalación y configuración sap.", enlace: "Paso_a_paso_instalación_de_aplicaciones.docx", categoria: "General", tipo: "archivo" },
    { id: 106, titulo: "Configurar acceso mediante VPN", descripcion: "Procedimiento y configuraciones para acceso VPN Fastpack", enlace: "V1 - Procedimiento para configurar acceso mediante VPN.docx", categoria: "Sistemas", tipo: "archivo" }
];

// CONFIGURACIÓN DINÁMICA DE URL
const API_BASE_URL = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
    ? "http://127.0.0.1:8001/api/auth" 
    : `${window.location.origin}/api/auth`;

// --- CONFIGURACIÓN DE SEGURIDAD ROOT (WHITELIST) ---
const SUPER_ADMINS = ["amureira", "sgomez", "sbasai"];

// Objeto de configuración para alertas profesionales pequeñas
const swalEstiloCompacto = {
    customClass: {
        popup: 'swal2-custom-compact-popup',
        title: 'swal2-custom-compact-title'
    },
    confirmButtonColor: '#0f172a'
};

document.addEventListener('DOMContentLoaded', () => {
    const miUsuarioActual = localStorage.getItem('fastpack_user')?.toLowerCase();

    // Verificación de seguridad: Solo administradores operan este archivo
    if (localStorage.getItem('fastpack_rol') !== 'admin') {
        window.location.href = 'index.html';
        return;
    }

    // PROTECCIÓN DE PANEL: Si no está en la Whitelist, se restringe la visualización del panel de usuarios
    if (!SUPER_ADMINS.includes(miUsuarioActual)) {
        const panelUsuarios = document.querySelector('aside.space-y-8');
        if (panelUsuarios) {
            panelUsuarios.innerHTML = `
                <div class="bg-orange-50 p-6 rounded-[2rem] border border-orange-100 shadow-sm">
                    <h2 class="text-lg font-bold mb-2 text-orange-700 flex items-center gap-2">
                        <i class="fas fa-user-lock"></i> Gestión Restringida
                    </h2>
                    <p class="text-[11px] text-orange-600 leading-relaxed font-medium">
                        Tu cuenta de administrador no tiene privilegios para modificar perfiles o permisos.
                        Esta sección está reservada para el personal de Infraestructura (Super-Admins).
                    </p>
                </div>`;
        }
    }

    cargarUsuarios();
    cargarHistorial();
    cargarTutorialesAdmin();

    const formEditUser = document.getElementById('form-edit-user');
    if (formEditUser) formEditUser.addEventListener('submit', guardarCambiosUsuario);

    const formEditTuto = document.getElementById('form-edit-tuto');
    if (formEditTuto) formEditTuto.addEventListener('submit', guardarCambiosTutorial);
});

// --- 1. GESTIÓN DE MANUALES (TABLA DE CONTENIDOS) ---

async function cargarTutorialesAdmin() {
    const listaTutos = document.getElementById('lista-tutoriales-admin');
    if (!listaTutos) return;

    try {
        let tutorialesFinales = [...tutorialesBase];
        const response = await fetch(`${API_BASE_URL}/tutoriales`);
        if (response.ok) {
            const tutorialesDB = await response.json();
            tutorialesFinales = [...tutorialesFinales, ...tutorialesDB];
        }

        listaTutos.innerHTML = '';
        tutorialesFinales.forEach(tuto => {
            const esBase = tuto.id >= 101 && tuto.id <= 106;
            listaTutos.innerHTML += `
                <tr class="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td class="p-4">
                        <div class="flex items-center gap-3">
                            <span class="w-2 h-2 rounded-full ${esBase ? 'bg-orange-500' : 'bg-blue-500'}"></span>
                            <div>
                                <p class="font-bold text-xs uppercase text-black">${tuto.titulo}</p>
                                <p class="text-[9px] text-slate-400 uppercase font-bold tracking-widest">
                                    ${tuto.categoria} ${esBase ? '<span class="text-orange-500">(BASE)</span>' : ''}
                                </p>
                            </div>
                        </div>
                    </td>
                    <td class="p-4 text-slate-500 text-xs truncate max-w-[200px]">
                        ${tuto.descripcion || 'Sin descripción'}
                    </td>
                    <td class="p-4 text-right flex justify-end gap-2">
                        <button onclick="prepararEdicionTuto(${tuto.id}, '${tuto.titulo.replace(/'/g, "\\'")}', '${tuto.descripcion ? tuto.descripcion.replace(/'/g, "\\'") : ''}')"
                                class="text-blue-600 hover:text-blue-800 p-1">
                            <i class="fas fa-edit text-xs"></i>
                        </button>
                        <button onclick="eliminarTutorialConfig(${tuto.id}, ${esBase})"
                                class="text-red-500 hover:text-red-700 p-1">
                            <i class="fas fa-trash-alt text-xs"></i>
                        </button>
                    </td>
                </tr>`;
        });
    } catch (error) { console.error("Error al cargar tutoriales admin:", error); }
}

function prepararEdicionTuto(id, titulo, desc) {
    document.getElementById('edit-tuto-id').value = id;
    document.getElementById('edit-tuto-titulo').value = titulo;
    document.getElementById('edit-tuto-desc').value = (desc === 'null' || desc === 'undefined') ? '' : desc;
    document.getElementById('modal-edit-tuto').classList.remove('hidden');
}

function cerrarModalTuto() {
    document.getElementById('modal-edit-tuto').classList.add('hidden');
}

async function guardarCambiosTutorial(e) {
    e.preventDefault();
    const id = document.getElementById('edit-tuto-id').value;
    const payload = {
        titulo: document.getElementById('edit-tuto-titulo').value,
        descripcion: document.getElementById('edit-tuto-desc').value
    };

    try {
        const response = await fetch(`${API_BASE_URL}/tutorial/update-info/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            Swal.fire({
                ...swalEstiloCompacto,
                title: "ÉXITO",
                text: "Información del manual actualizada",
                icon: "success",
                timer: 2000,
                showConfirmButton: false
            });
            cerrarModalTuto();
            cargarTutorialesAdmin();
        } else {
            const errData = await response.json();
            throw new Error(errData.detail || "Error en servidor");
        }
    } catch (error) {
        Swal.fire({
            ...swalEstiloCompacto,
            title: "ATENCIÓN",
            text: "No se puede actualizar manuales del núcleo (Base) desde la web.",
            icon: "info"
        });
    }
}

async function eliminarTutorialConfig(id, esBase) {
    if (esBase) {
        Swal.fire({
            ...swalEstiloCompacto,
            title: "PROTEGIDO",
            text: "Este manual es parte del núcleo del sistema.",
            icon: "warning"
        });
        return;
    }

    const { value: confirmacion } = await Swal.fire({
        ...swalEstiloCompacto,
        title: '¿ELIMINAR MANUAL?',
        text: "Se quitará definitivamente del portal.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'SÍ, ELIMINAR',
        cancelButtonText: 'CANCELAR'
    });

    if (confirmacion) {
        try {
            const response = await fetch(`${API_BASE_URL}/tutorial/delete/${id}`, { method: 'DELETE' });
            if (response.ok) {
                Swal.fire({
                    title: '¡MANUAL ELIMINADO!',
                    text: 'El registro se ha quitado correctamente.',
                    icon: 'success',
                    confirmButtonColor: '#0f172a'
                });
                cargarTutorialesAdmin();
            }
        } catch (error) { console.error(error); }
    }
}

// --- 2. GESTIÓN DE USUARIOS Y LÓGICA DE PERMISOS ---

async function cargarUsuarios() {
    const listaUsuarios = document.getElementById('lista-usuarios-admin');
    if (!listaUsuarios) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin/usuarios`);
        const usuarios = await response.json();
        listaUsuarios.innerHTML = '';

        usuarios.forEach(user => {
            const fechaCreacion = new Date(user.creado_en).toLocaleDateString('es-CL');
            listaUsuarios.innerHTML += `
                <div class="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex justify-between items-center hover:shadow-md transition-all mb-3 text-black">
                    <div>
                        <p class="font-bold text-sm uppercase">${user.nombre}</p>
                        <p class="text-[9px] text-slate-500 uppercase tracking-tighter">
                            USUARIO: <span class="text-zinc-600">${user.username}</span> •
                            ROL: <span class="text-blue-600 font-bold">${user.rol}</span>
                        </p>
                        <p class="text-[9px] text-zinc-400 uppercase mt-1">CREADO: ${fechaCreacion}</p>
                    </div>
                    <div class="text-right flex flex-col items-end gap-1">
                        <button onclick="prepararEdicionUsuario(${user.id})" class="text-blue-600 text-[10px] font-bold uppercase hover:underline">Editar</button>
                    </div>
                </div>`;
        });
    } catch (error) { console.error("Error al cargar usuarios:", error); }
}

async function prepararEdicionUsuario(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/usuarios`);
        const usuarios = await response.json();
        const user = usuarios.find(u => u.id === id);
        if (!user) return;

        document.getElementById('edit-user-id').value = user.id;
        document.getElementById('edit-user-nombre').value = user.nombre;
        document.getElementById('display-username').textContent = `ID: ${user.username.toUpperCase()} (${user.rol.toUpperCase()})`;
        document.getElementById('edit-user-pass').value = "";

        const checkIds = ['perm-upload', 'perm-suppliers', 'perm-update', 'perm-delete', 'perm-convertir', 'perm-renombrar'];
        checkIds.forEach(cid => {
            const el = document.getElementById(cid);
            if (el) {
                const fieldName = cid.replace('-', '_');
                el.checked = user[fieldName] || false;
            }
        });

        document.getElementById('modal-edit-user').classList.remove('hidden');
    } catch (error) { console.error(error); }
}

function cerrarModalUser() {
    document.getElementById('modal-edit-user').classList.add('hidden');
}

async function guardarCambiosUsuario(e) {
    e.preventDefault();
    const miUsuarioActual = localStorage.getItem('fastpack_user')?.toLowerCase();

    if (!SUPER_ADMINS.includes(miUsuarioActual)) {
        Swal.fire({
            ...swalEstiloCompacto,
            title: "Acceso Denegado",
            text: "No tienes privilegios de Super-Administrador.",
            icon: "error",
            confirmButtonColor: "#ef4444"
        });
        return;
    }

    const seguroChecked = (id) => {
        const el = document.getElementById(id);
        return el ? el.checked : false;
    };

    const id = document.getElementById('edit-user-id').value;
    const payload = {
        nombre: document.getElementById('edit-user-nombre').value,
        password: document.getElementById('edit-user-pass').value || null,
        perm_upload: seguroChecked('perm-upload'),
        perm_suppliers: seguroChecked('perm-suppliers'),
        perm_update: seguroChecked('perm-update'),
        perm_delete: seguroChecked('perm-delete'),
        perm_convertir: seguroChecked('perm-convertir'),
        perm_renombrar: seguroChecked('perm-renombrar'),
        operador_id: miUsuarioActual 
    };

    try {
        const response = await fetch(`${API_BASE_URL}/admin/usuario/update/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            Swal.fire({
                ...swalEstiloCompacto,
                title: "ÉXITO",
                text: "Perfil actualizado correctamente.",
                icon: "success",
                timer: 2000,
                showConfirmButton: false
            });
            cerrarModalUser();
            cargarUsuarios();
        }
    } catch (error) { console.error(error); }
}

async function eliminarPerfilUsuario() {
    const miUsuarioActual = localStorage.getItem('fastpack_user')?.toLowerCase();
    if (!SUPER_ADMINS.includes(miUsuarioActual)) return;

    const userId = document.getElementById('edit-user-id').value;
    const { value: confirmacion } = await Swal.fire({
        ...swalEstiloCompacto,
        title: `¿ELIMINAR USUARIO?`,
        html: `<span style="font-size: 12px;">Escribe <b>CONFIRMAR</b> para proceder:</span>`,
        input: 'text',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'ELIMINAR',
        cancelButtonText: 'CANCELAR',
        preConfirm: (texto) => {
            if (texto !== 'CONFIRMAR') {
                Swal.showValidationMessage('Escribe CONFIRMAR exactamente');
            }
            return texto;
        }
    });

    if (confirmacion === 'CONFIRMAR') {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/usuario/delete/${userId}/${miUsuarioActual}`, { 
                method: 'DELETE' 
            });
            if (response.ok) {
                cerrarModalUser();
                cargarUsuarios();
            }
        } catch (error) { console.error(error); }
    }
}

async function cargarHistorial() {
    const tbody = document.getElementById('historial-body');
    if (!tbody) return;
    try {
        const response = await fetch(`${API_BASE_URL}/admin/historial`);
        const registros = await response.json();
        tbody.innerHTML = '';
        registros.forEach(log => {
            const fechaLog = new Date(log.fecha).toLocaleString('es-CL');
            tbody.innerHTML += `
                <tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-colors text-black text-xs">
                    <td class="p-4 font-bold uppercase">${log.usuario_nombre}</td>
                    <td class="p-4 text-slate-600">${log.accion}</td>
                    <td class="p-4 text-slate-400 font-mono">${fechaLog}</td>
                </tr>`;
        });
    } catch (error) { console.error(error); }
}

function mostrarAnuncio(mensaje) {
    Swal.fire({
        ...swalEstiloCompacto,
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: mensaje,
        showConfirmButton: false,
        timer: 3000
    });
}