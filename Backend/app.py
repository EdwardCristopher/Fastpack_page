from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pdf2docx import Converter
import io
import os
import tempfile
import shutil
import subprocess  # Para usar herramientas de sistema en la nube

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"]
)

# --- CONVERSIÓN PDF A WORD (Se mantiene igual, funciona bien en Linux) ---
@app.post("/convertir-pdf-a-word")
async def pdf_to_word(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="El archivo debe ser un PDF")

    temp_dir = tempfile.mkdtemp()
    pdf_path = os.path.join(temp_dir, "input.pdf")
    docx_path = os.path.join(temp_dir, "output.docx")

    try:
        with open(pdf_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        cv = Converter(pdf_path)
        cv.convert(docx_path, start=0, multi_processing=False) 
        cv.close()

        with open(docx_path, "rb") as f:
            contenido = f.read()

        clean_name = file.filename.split('.')[0]
        return StreamingResponse(
            io.BytesIO(contenido),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename={clean_name}.docx"}
        )
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

# --- CONVERSIÓN WORD A PDF (NUEVA LÓGICA PARA LA NUBE) ---
@app.post("/convertir-word-a-pdf")
async def word_to_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.docx'):
        raise HTTPException(status_code=400, detail="El archivo debe ser un DOCX")

    temp_dir = tempfile.mkdtemp()
    docx_path = os.path.join(temp_dir, "input.docx")

    try:
        with open(docx_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Usamos LibreOffice (comando 'soffice') para convertir en Linux
        # Este comando es el estándar para servidores 24/7
        subprocess.run([
            'soffice', '--headless', '--convert-to', 'pdf', 
            '--outdir', temp_dir, docx_path
        ], check=True)

        pdf_path = os.path.join(temp_dir, "input.pdf")
        
        with open(pdf_path, "rb") as f:
            contenido = f.read()

        clean_name = file.filename.split('.')[0]
        return StreamingResponse(
            io.BytesIO(contenido),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={clean_name}.pdf"}
        )
    except Exception as e:
        print(f"Error Word to PDF: {str(e)}")
        raise HTTPException(status_code=500, detail="Error en el servidor de conversión")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)