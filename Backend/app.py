from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pdf2docx import Converter
from docx2pdf import convert
import io
import os
import pythoncom
import tempfile
import shutil

app = FastAPI()

# 1. CORS CONFIGURADO PARA EXPONER CABECERAS
# Esto permite que el JavaScript lea el nombre del archivo enviado
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"] # <--- CRÍTICO PARA DESCARGAS
)

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
        # Cambiamos multi_processing a False por estabilidad en servidores locales
        cv.convert(docx_path, start=0, multi_processing=False) 
        cv.close()

        with open(docx_path, "rb") as f:
            contenido = f.read()

        # Nombre limpio para el archivo
        clean_name = file.filename.split('.')[0]

        return StreamingResponse(
            io.BytesIO(contenido),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f"attachment; filename={clean_name}.docx",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as e:
        print(f"Error PDF to Word: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error en conversión: {str(e)}")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

@app.post("/convertir-word-a-pdf")
async def word_to_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.docx'):
        raise HTTPException(status_code=400, detail="El archivo debe ser un DOCX")

    temp_dir = tempfile.mkdtemp()
    docx_path = os.path.join(temp_dir, "input.docx")
    pdf_path = os.path.join(temp_dir, "output.pdf")

    try:
        with open(docx_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        pythoncom.CoInitialize()
        convert(docx_path, pdf_path)
        
        with open(pdf_path, "rb") as f:
            contenido = f.read()

        clean_name = file.filename.split('.')[0]

        return StreamingResponse(
            io.BytesIO(contenido),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={clean_name}.pdf",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as e:
        print(f"Error Word to PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error en conversión: {str(e)}")
    finally:
        pythoncom.CoUninitialize()
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == "__main__":
    import uvicorn
    # Cambiamos a 0.0.0.0 para que sea accesible desde cualquier IP local
    uvicorn.run(app, host="0.0.0.0", port=8000)