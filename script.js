// --- DATOS INICIALES Y PERSISTENCIA ---
let proveedores = JSON.parse(localStorage.getItem('fastpack_proveedores')) || [
    { empresa: "Entel Empresas", servicio: "Internet y Telefonía", contacto: "Juan Pérez", info: "+56 9 2008 0851", estado: "Activo" },
    { empresa: "Autodesk Latam", servicio: "Licencias Software", contacto: "Soporte Técnico", info: "soporte@autodesk.com", estado: "Activo" },
    { empresa: "PC Factory", servicio: "Hardware y Periféricos", contacto: "Mesa de Ayuda", info: "contacto@pcfactory.cl", estado: "Activo" },
    { empresa: "AWS Cloud", servicio: "Servidores y Hosting", contacto: "Admin Cloud", info: "admin@amazon.com", estado: "Pendiente" },
    { empresa: "Entel Corporaciones", servicio: "Enlaces de Respaldo", contacto: "María Jara", info: "+56 2 2800 1000", estado: "Activo" }
];

const tutorialesBase = [
    { id: 101, titulo: "Creación de Usuario", descripcion: "Manual para registro de usuarios en dominio Fastpack.", enlace: "Creación_de_usuario.docx", categoria: "Sistemas", tipo: "archivo" },
    { id: 102, titulo: "Autodesk Desktop Connector", descripcion: "Guía de instalación desde web Autodesk.", enlace: "Instalación_autodesk_desktop_connector.docx", categoria: "Ingeniería", tipo: "archivo" },
    { id: 103, titulo: "Spoolgen e ISL", descripcion: "Instalación de componentes Spoolgen y licencias ISL.", enlace: "instalación_de_spoolgen_y_ISL.docx", categoria: "Sistemas", tipo: "archivo" },
    { id: 104, titulo: "Configuración BEAS", descripcion: "Parámetros necesarios para módulo BEAS.", enlace: "Instalación_y_configuración_BEAS.docx", categoria: "Sistemas", tipo: "archivo" },
    { id: 105, titulo: "Paso a paso Aplicaciones", descripcion: "Listado de software corporativo e instalación y configuración sap.", enlace: "Paso_a_paso_instalación_de_aplicaciones.docx", categoria: "General", tipo: "archivo" },
    { id: 106, titulo: "Configurar acceso VPN", descripcion: "Procedimiento y configuraciones para acceso VPN Fastpack", enlace: "V1 - Procedimiento para configurar acceso mediante VPN.docx", categoria: "Sistemas", tipo: "archivo" }
];

// --- SELECTORES ---
const API_AUTH_URL = "http://127.0.0.1:8001";
const contenedorArchivos = document.getElementById('contenedor-archivos');
const contenedorVideos = document.getElementById('contenedor-videos');
const buscador = document.getElementById('buscador');
const vistaTutoriales = document.getElementById('vista-tutoriales');
const vistaConversor = document.getElementById('vista-conversor');
const vistaProveedores = document.getElementById('vista-proveedores');
const tablaProveedoresBody = document.getElementById('tabla-proveedores-body');
const archivoInput = document.getElementById('archivoInput');
const fileNameSpan = document.getElementById('fileName');

const modalProveedor = document.getElementById('modal-proveedor');
const formProveedor = document.getElementById('form-proveedor');
const btnAccionesCrud = document.getElementById('btnAccionesCrud');
const iconoCrud = document.getElementById('icono-crud'); 
const menuCrud = document.getElementById('menu-crud');

const buscadorProveedores = document.getElementById('buscador-proveedores');
const filtroEstatusBtn = document.getElementById('filtro-estatus-btn');
const filtroOpciones = document.getElementById('filtro-opciones');

const modalConfirmacion = document.getElementById('modal-confirmacion');
const btnAceptarEliminar = document.getElementById('aceptar-confirmacion');
const btnCancelarEliminar = document.getElementById('cancelar-confirmacion');

let filtroActual = 'Todos';
let modoBorrarActivo = false;
let indiceAEliminar = null;
let tutorialesActuales = []; 

// --- PERSISTENCIA ---
function guardarEnStorage() {
    localStorage.setItem('fastpack_proveedores', JSON.stringify(proveedores));
}

// --- SISTEMA DE ANUNCIOS ---
function mostrarAnuncio(mensaje, tipo = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-card ${tipo === 'success' ? 'toast-success' : 'toast-error'}`;
    toast.innerHTML = `<span class="text-sm font-medium">${mensaje}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- NAVEGACIÓN Y SEGURIDAD ---
function redigirAConfig() {
    if (localStorage.getItem('fastpack_rol') === 'admin') {
        window.location.href = 'config.html';
    } else {
        mostrarAnuncio("Acceso denegado: Se requiere perfil de Administrador", "error");
    }
}

function mostrarSeccion(seccion) {
    if (!localStorage.getItem('fastpack_user')) {
        window.location.href = 'login.html';
        return;
    }

    const rol = localStorage.getItem('fastpack_rol');
    const tienePermisoSuppliers = localStorage.getItem('perm_suppliers') === 'true';
    const esAdmin = rol === 'admin';
    const esPracticante = rol === 'practicante';

    if (seccion === 'proveedores' && (esPracticante || (!esAdmin && !tienePermisoSuppliers))) {
        Swal.fire({
            title: 'ACCESO DENEGADO',
            text: 'Tu perfil actual no tiene autorización para acceder al Directorio de Proveedores.',
            icon: 'error',
            confirmButtonColor: '#0f172a'
        });
        return;
    }

    [vistaTutoriales, vistaConversor, vistaProveedores].forEach(v => v?.classList.add('hidden'));
    btnAccionesCrud?.classList.add('hidden'); 

    const btnTutorialesMain = document.getElementById('tutorial-actions-main');

    if (seccion === 'tutoriales') {
        vistaTutoriales?.classList.remove('hidden');
        btnTutorialesMain?.classList.remove('hidden');
        cargarTutorialesDesdeDB(); 
    } else if (seccion === 'conversor') {
        vistaConversor?.classList.remove('hidden');
        btnTutorialesMain?.classList.add('hidden');
    } else if (seccion === 'proveedores') {
        vistaProveedores?.classList.remove('hidden');
        btnTutorialesMain?.classList.add('hidden');

        if (esAdmin && tienePermisoSuppliers) {
            btnAccionesCrud?.classList.remove('hidden'); 
        } else if (esAdmin && !tienePermisoSuppliers) {
            mostrarAnuncio("Modo consulta: Privilegios de edición restringidos", "error");
        }

        filtrarProveedores(); 
    }
}

// --- LÓGICA DE IDENTIDAD ---
function inicializarIdentidad() {
    const nombre = localStorage.getItem('fastpack_nombre');
    const rol = localStorage.getItem('fastpack_rol');
    const tienePermisoSuppliers = localStorage.getItem('perm_suppliers') === 'true';
    const esAdmin = rol === 'admin';
    const esPracticante = rol === 'practicante';

    if (nombre) {
        if (document.getElementById('nav-user-name')) document.getElementById('nav-user-name').textContent = nombre.toUpperCase();
        if (document.getElementById('nav-user-rol')) document.getElementById('nav-user-rol').textContent = rol;
        
        const welcomeContainer = document.getElementById('welcome-name');
        if (welcomeContainer) {
            welcomeContainer.textContent = nombre.split(' ')[0].toUpperCase(); 
        }
        
        const userInfo = document.getElementById('user-info-navbar');
        if (userInfo) userInfo.classList.remove('hidden');
    }

    const btnNavProveedores = document.querySelector('button[onclick="mostrarSeccion(\'proveedores\')"]');
    if (btnNavProveedores && (esPracticante || (!esAdmin && !tienePermisoSuppliers))) {
        btnNavProveedores.style.display = 'none';
    }
}

function logout() {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: '¿CERRAR SESIÓN?',
            text: "Finalizarás tu acceso al Portal Técnico Fastpack.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#0f172a', 
            cancelButtonColor: '#64748b',
            confirmButtonText: 'SÍ, SALIR',
            cancelButtonText: 'CANCELAR',
            reverseButtons: true,
            backdrop: `rgba(15, 23, 42, 0.6)` 
        }).then((result) => {
            if (result.isConfirmed) {
                localStorage.clear();
                window.location.href = 'login.html';
            }
        });
    } else {
        if (confirm("¿Cerrar sesión de Fastpack?")) {
            localStorage.clear();
            window.location.href = 'login.html';
        }
    }
}

// --- GESTIÓN DE MODAL TUTORIAL ---
function abrirModalTutorial() {
    const modal = document.getElementById('modal-tutorial');
    if (modal) {
        document.getElementById('modal-tuto-titulo').innerHTML = 'Publicar <span class="text-blue-500">Tutorial</span>';
        document.getElementById('form-tutorial-portal').reset();
        document.getElementById('edit-tuto-id').value = '';
        document.getElementById('tutoFileName').textContent = "selecciona el archivo";
        modal.classList.remove('hidden');
    }
}

function cerrarModalTutorial() {
    const modal = document.getElementById('modal-tutorial');
    if (modal) modal.classList.add('hidden');
}

// --- CARGA DINÁMICA DE TUTORIALES ---
async function cargarTutorialesDesdeDB() {
    try {
        const response = await fetch(`${API_AUTH_URL}/tutoriales`);
        const data = await response.json();
        tutorialesActuales = [...tutorialesBase, ...data];
        renderizar(tutorialesActuales);
    } catch (error) {
        tutorialesActuales = tutorialesBase;
        renderizar(tutorialesActuales);
    }
}

// --- RENDERIZADO (MEJORADO: BOTONES CENTRADOS Y ESTILO MODERNO) ---
function renderizar(lista) {
    if(!contenedorArchivos || !contenedorVideos) return;
    
    contenedorArchivos.innerHTML = '';
    contenedorVideos.innerHTML = '';
    
    const puedeBorrar = localStorage.getItem('perm_delete') === 'true';
    const puedeActualizar = localStorage.getItem('perm_update') === 'true';

    lista.forEach(tuto => {
        const enlaceLower = tuto.enlace.toLowerCase();
        const esVideo = enlaceLower.endsWith('.mp4');
        const esPDF = enlaceLower.endsWith('.pdf');
        
        let iconoSrc = "https://cdn-icons-png.flaticon.com/512/888/888883.png"; 
        if (esVideo) {
            iconoSrc = "https://cdn-icons-png.flaticon.com/512/1179/1179069.png"; 
        } else if (esPDF) {
            iconoSrc = "https://cdn-icons-png.flaticon.com/512/337/337946.png"; 
        }

        const rutaDescarga = `${API_AUTH_URL}/assets/docs/${tuto.enlace}`;

        const tarjetaHTML = `
            <div class="word-card relative group transition-all duration-300 hover:shadow-2xl overflow-hidden bg-white rounded-2xl p-6 border border-zinc-100">
                
                <span class="absolute top-4 left-4 z-20 px-3 py-1 bg-zinc-900 border border-zinc-700 text-white text-[9px] font-black uppercase tracking-[0.15em] rounded-md shadow-sm">
                    ${tuto.category || tuto.categoria}
                </span>

                <div class="absolute inset-0 flex flex-col items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-40 bg-white/80 backdrop-blur-[3px] rounded-2xl">
                    
                    <div class="flex gap-4 mb-2">
                        ${puedeActualizar ? `
                            <button onclick="prepararEdicionArchivo(${tuto.id})" 
                                    class="bg-blue-600 text-white w-12 h-12 rounded-full shadow-xl flex items-center justify-center transform hover:scale-110 active:scale-95 transition-all hover:bg-blue-700">
                                <i class="fas fa-edit text-sm"></i>
                            </button>` : ''}
                        ${puedeBorrar ? `
                            <button onclick="confirmarBorradoArchivo(${tuto.id})" 
                                    class="bg-red-500 text-white w-12 h-12 rounded-full shadow-xl flex items-center justify-center transform hover:scale-110 active:scale-95 transition-all hover:bg-red-600">
                                <i class="fas fa-trash text-sm"></i>
                            </button>` : ''}
                    </div>

                    <a href="${rutaDescarga}" ${esVideo || esPDF ? 'target="_blank"' : 'download'} 
                       class="px-8 py-3.5 rounded-full font-bold uppercase tracking-widest text-[10px] transition-all 
                              bg-gradient-to-r from-orange-500 to-orange-600 text-white 
                              hover:from-orange-600 hover:to-orange-700 hover:shadow-orange-200 shadow-xl 
                              transform hover:-translate-y-1 active:translate-y-0 flex items-center gap-2">
                        <i class="fas ${esVideo ? 'fa-play' : 'fa-download'}"></i>
                        ${esVideo ? 'Ver Tutorial' : (esPDF ? 'Ver PDF' : 'Descargar Word')}
                    </a>
                </div>

                <div class="relative z-10 pt-4">
                    <div class="flex justify-end mb-6">
                        <div class="w-10 h-10 flex items-center justify-center bg-zinc-50 rounded-xl -mt-2">
                            <img src="${iconoSrc}" class="w-7 h-7 object-contain" alt="File Icon">
                        </div>
                    </div>
                    <h3 class="text-zinc-900 font-black text-base line-clamp-1 mb-2 tracking-tight uppercase">${tuto.titulo}</h3>
                    <p class="text-zinc-500 text-[11px] leading-relaxed line-clamp-2 min-h-[32px] font-medium">${tuto.descripcion || 'Sin descripción'}</p>
                </div>
            </div>`;

        if (esVideo) {
            contenedorVideos.innerHTML += tarjetaHTML;
        } else {
            contenedorArchivos.innerHTML += tarjetaHTML;
        }
    });

    if (contenedorArchivos.innerHTML === '') contenedorArchivos.innerHTML = '<p class="text-zinc-400 text-[10px] py-10 uppercase font-black text-center col-span-full tracking-widest">No hay documentación técnica disponible.</p>';
    if (contenedorVideos.innerHTML === '') contenedorVideos.innerHTML = '<p class="text-zinc-400 text-[10px] py-10 uppercase font-black text-center col-span-full tracking-widest">No hay capacitaciones visuales disponibles.</p>';
}

// --- IMPLEMENTACIÓN: EDICIÓN RÁPIDA ---
function prepararEdicionArchivo(id) {
    const tuto = tutorialesActuales.find(t => t.id === id);
    if (!tuto) return;

    document.getElementById('edit-id-index').value = tuto.id;
    document.getElementById('edit-titulo-index').value = tuto.titulo;
    document.getElementById('edit-desc-index').value = tuto.descripcion || '';
    
    const modal = document.getElementById('modal-edicion-index');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.firstElementChild.classList.remove('scale-95', 'opacity-0');
        modal.firstElementChild.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function cerrarEdicionIndex() {
    const modal = document.getElementById('modal-edicion-index');
    modal.firstElementChild.classList.remove('scale-100', 'opacity-100');
    modal.firstElementChild.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 200);
}

// --- LÓGICA DE BORRADO DE TUTORIALES ---
async function confirmarBorradoArchivo(id) {
    const { value: confirmacion } = await Swal.fire({
        title: '¿ELIMINAR ARCHIVO?',
        text: "Esta acción borrará el tutorial permanentemente del portal.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'SÍ, ELIMINAR',
        cancelButtonText: 'CANCELAR',
        reverseButtons: true
    });

    if (confirmacion) {
        try {
            const response = await fetch(`${API_AUTH_URL}/tutorial/delete/${id}`, { method: 'DELETE' });
            if (response.ok) {
                mostrarAnuncio("Archivo eliminado correctamente");
                cargarTutorialesDesdeDB();
            }
        } catch (error) {
            mostrarAnuncio("Error al conectar con el servidor", "error");
        }
    }
}

// --- LÓGICA CRUD PROVEEDORES ---
function toggleModoEdicion() {
    menuCrud?.classList.toggle('hidden');
    if(iconoCrud) iconoCrud.classList.toggle('rotate-technical');
}

function activarModoBorrar() {
    modoBorrarActivo = !modoBorrarActivo;
    tablaProveedoresBody?.classList.toggle('modo-borrar');
    toggleModoEdicion();
    if(modoBorrarActivo) {
        mostrarAnuncio("Modo eliminación activado", "error");
    }
}

function eliminarProveedor(index, event) {
    event.stopPropagation(); 
    indiceAEliminar = index; 
    modalConfirmacion?.classList.remove('hidden'); 
}

function cerrarConfirmacion() {
    modalConfirmacion?.classList.add('hidden');
    indiceAEliminar = null;
}

function prepararEdicion(index) {
    const tienePermiso = localStorage.getItem('perm_suppliers') === 'true';
    const esAdmin = localStorage.getItem('fastpack_rol') === 'admin';
    
    if (!esAdmin || !tienePermiso) {
        mostrarAnuncio("Acceso denegado a edición", "error");
        return;
    }

    const p = proveedores[index];
    document.getElementById('modal-titulo').innerHTML = `Modificar <span class="text-blue-500">Proveedor</span>`;
    document.getElementById('edit-index').value = index;
    document.getElementById('add-empresa').value = p.empresa;
    document.getElementById('add-servicio').value = p.servicio;
    document.getElementById('add-contacto').value = p.contacto;
    document.getElementById('add-info').value = p.info;
    document.getElementById('add-estado').value = p.estado;
    modalProveedor?.classList.remove('hidden');
}

function abrirModalProveedor() {
    document.getElementById('modal-titulo').innerHTML = `Añadir <span class="text-blue-500">Proveedor</span>`;
    document.getElementById('edit-index').value = "-1";
    formProveedor?.reset();
    modalProveedor?.classList.remove('hidden');
    toggleModoEdicion();
}

function cerrarModalProveedor() {
    modalProveedor?.classList.add('hidden');
    formProveedor?.reset();
}

function renderizarProveedores(lista) {
    if (!tablaProveedoresBody) return;
    tablaProveedoresBody.innerHTML = '';
    const esAdmin = localStorage.getItem('fastpack_rol') === 'admin';
    const tienePermiso = localStorage.getItem('perm_suppliers') === 'true';
    
    lista.forEach((p) => {
        const statusClass = p.estado === 'Activo' ? 'status-active' : 'status-pending';
        const originalIndex = proveedores.indexOf(p);
        const puedeEditar = esAdmin && tienePermiso;

        tablaProveedoresBody.innerHTML += `
            <div onclick="${puedeEditar ? `prepararEdicion(${originalIndex})` : ''}" 
                 class="supplier-row grid grid-cols-5 p-4 items-center ${puedeEditar ? 'cursor-pointer' : 'cursor-default'} relative group">
                ${puedeEditar ? `<button onclick="eliminarProveedor(${originalIndex}, event)" class="btn-eliminar-fila"><i class="fas fa-trash-alt"></i></button>` : ''}
                <div class="celda-empresa truncate pr-2">${p.empresa}</div>
                <div class="celda-servicio truncate pr-2">${p.servicio}</div>
                <div class="celda-contacto truncate pr-2">${p.contacto}</div>
                <div class="celda-info truncate">${p.info}</div>
                <div class="flex justify-end"><span class="status-badge ${statusClass}">${p.estado}</span></div>
            </div>`;
    });
}

function filtrarProveedores() {
    const busqueda = buscadorProveedores ? buscadorProveedores.value.toLowerCase() : "";
    const filtrados = proveedores.filter(p => {
        const coincideTexto = Object.values(p).some(v => v.toString().toLowerCase().includes(busqueda));
        const coincideEstatus = filtroActual === 'Todos' || p.estado === filtroActual;
        return coincideTexto && coincideEstatus;
    });
    renderizarProveedores(filtrados);
}

function setFiltro(valor) {
    filtroActual = valor;
    if (filtroEstatusBtn) filtroEstatusBtn.innerHTML = `Estatus: ${valor} ▾`;
    if (filtroOpciones) filtroOpciones.classList.add('hidden');
    filtrarProveedores();
}

// --- FUNCIÓN DE CONVERSIÓN ACTUALIZADA PARA LA NUBE ---
async function iniciarConversion() {
    const tipo = document.getElementById('tipoConversion').value;
    const loader = document.getElementById('loader');
    const btn = document.getElementById('btnAccion');
    
    if (!archivoInput.files || archivoInput.files.length === 0) { 
        mostrarAnuncio("Seleccione un archivo", "error"); 
        return; 
    }

    loader.classList.remove('hidden');
    btn.disabled = true;

    const formData = new FormData();
    formData.append('file', archivoInput.files[0]);

    // DEFINICIÓN DE ENDPOINTS UNIFICADOS
    const endpoint = tipo === 'pdf-to-word' ? 'convertir-pdf-a-word' : 'convertir-word-a-pdf';
    
    // Determinamos la URL base (Usa la de config.js o la de Railway directamente)
    // Importante: Aquí usamos la ruta /api/converter que definiremos en main.py
   const BASE_CONVERTER_URL = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
    ? "http://127.0.0.1:8001/api/converter" 
    : "https://fastpackpage-production.up.railway.app/api/converter";

    try {
        // Ahora el fetch apunta al punto de entrada unificado
        const response = await fetch(`${BASE_CONVERTER_URL}/${endpoint}`, { 
            method: 'POST', 
            body: formData 
        });

        if (!response.ok) throw new Error("Error en la conversión");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        // Mantenemos tu lógica de nombre de archivo
        const extension = tipo === 'pdf-to-word' ? 'docx' : 'pdf';
        link.setAttribute('download', `Fastpack_Doc_${Date.now()}.${extension}`);

        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => { 
            window.URL.revokeObjectURL(url); 
            link.remove(); 
        }, 100);

        mostrarAnuncio("¡Conversión exitosa!");
        archivoInput.value = "";
        fileNameSpan.textContent = "Seleccionar archivo...";

    } catch (error) {
        // Mensaje actualizado para ser más descriptivo
        mostrarAnuncio("Error: No se pudo conectar con el servicio de conversión", "error");
        console.error("Detalle del error:", error);
    } finally {
        loader.classList.add('hidden');
        btn.disabled = false;
    }
}
// --- INICIALIZACIÓN Y EVENTOS ---
document.addEventListener('DOMContentLoaded', () => {
    inicializarIdentidad();
    cargarTutorialesDesdeDB();
    
    if (archivoInput) {
        archivoInput.addEventListener('change', function(e) {
            if (e.target.files.length > 0) {
                fileNameSpan.textContent = e.target.files[0].name;
                fileNameSpan.style.color = "#3b82f6";
            }
        });
    }

    const fileTutoInput = document.getElementById('add-tuto-file');
    if (fileTutoInput) {
        fileTutoInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                document.getElementById('tutoFileName').textContent = e.target.files[0].name;
                document.getElementById('tutoFileName').style.color = "#3b82f6";
            }
        });
    }

    // Guardado de edición rápida en el Index
    document.getElementById('form-edicion-rapida')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-id-index').value;
        const payload = {
            titulo: document.getElementById('edit-titulo-index').value,
            descripcion: document.getElementById('edit-desc-index').value
        };

        try {
            const response = await fetch(`${API_AUTH_URL}/tutorial/update-info/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                mostrarAnuncio("Contenido actualizado");
                cerrarEdicionIndex();
                cargarTutorialesDesdeDB();
            } else {
                Swal.fire({ title: "NOTA", text: "Este manual es de solo lectura (BASE).", icon: "info" });
            }
        } catch (error) {
            mostrarAnuncio("Error al guardar cambios", "error");
        }
    });

    document.getElementById('form-tutorial-portal')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileField = document.getElementById('add-tuto-file');
        if (fileField.files.length === 0) {
            mostrarAnuncio("Seleccione un archivo primero", "error");
            return;
        }

        const formData = new FormData();
        formData.append('titulo', document.getElementById('add-tuto-titulo').value);
        formData.append('descripcion', document.getElementById('add-tuto-desc').value);
        formData.append('categoria', document.getElementById('add-tuto-cat').value);
        formData.append('username_autor', localStorage.getItem('fastpack_user'));
        formData.append('file', fileField.files[0]);

        try {
            const response = await fetch(`${API_AUTH_URL}/tutorial/upload`, {
                method: 'POST',
                body: formData 
            });

            if (response.ok) {
                mostrarAnuncio("Tutorial subido correctamente");
                cerrarModalTutorial();
                cargarTutorialesDesdeDB();
            } else {
                const err = await response.json();
                mostrarAnuncio(err.detail || "Error en la subida", "error");
            }
        } catch (error) {
            mostrarAnuncio("Error de conexión con el servidor", "error");
        }
    });

    formProveedor?.addEventListener('submit', (e) => {
        e.preventDefault();
        const index = parseInt(document.getElementById('edit-index').value);
        const datos = {
            empresa: document.getElementById('add-empresa').value,
            servicio: document.getElementById('add-servicio').value,
            contacto: document.getElementById('add-contacto').value,
            info: document.getElementById('add-info').value,
            estado: document.getElementById('add-estado').value
        };
        if (index === -1) {
            proveedores.unshift(datos);
            mostrarAnuncio("Proveedor añadido");
        } else {
            proveedores[index] = datos;
            mostrarAnuncio("Registro actualizado");
        }
        guardarEnStorage();
        cerrarModalProveedor();
        filtrarProveedores();
    });

    btnAceptarEliminar?.addEventListener('click', () => {
        if (indiceAEliminar !== null) {
            proveedores.splice(indiceAEliminar, 1);
            guardarEnStorage();
            filtrarProveedores();
            mostrarAnuncio("Proveedor eliminado", "success");
        }
        cerrarConfirmacion();
    });

    btnCancelarEliminar?.addEventListener('click', cerrarConfirmacion);

    if (buscador) {
        buscador.addEventListener('input', (e) => {
            const busqueda = e.target.value.toLowerCase();
            const filtrados = tutorialesActuales.filter(t => 
                t.titulo.toLowerCase().includes(busqueda) || t.categoria.toLowerCase().includes(busqueda)
            );
            renderizar(filtrados);
        });
    }

    if (buscadorProveedores) buscadorProveedores.addEventListener('input', filtrarProveedores);
    if (filtroEstatusBtn) {
        filtroEstatusBtn.addEventListener('click', (e) => { 
            e.stopPropagation(); 
            filtroOpciones?.classList.toggle('hidden'); 
        });
    }
    document.addEventListener('click', () => { if(filtroOpciones) filtroOpciones.classList.add('hidden'); });
});