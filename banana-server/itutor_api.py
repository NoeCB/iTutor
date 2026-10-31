#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Servidor Backend API REST + Autenticación JWT/Hash + Mensajería + Base de Datos SQLite para iTUTOR
Diseñado para ejecutarse en Banana Pi M2 Berry (ARM Linux) tras NAT en puerto 3000.
No requiere dependencias externas (usa la librería estándar de Python 3 + SQLite3).
"""

import base64
import binascii
import csv
import hashlib
import html as html_lib
import io
import json
import os
import re
import secrets
import socket
import sqlite3
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, unquote, urlparse

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "itutor.db")
PORT = 3000

# Límites de tamaño. El PDF viaja en binario (sin la inflación del 33 % de base64).
MAX_PDF_BYTES = 8 * 1024 * 1024          # PDF máximo aceptado por el servidor
MAX_JSON_BYTES = 256 * 1024              # cuerpo JSON normal
MAX_LEGACY_JSON_BYTES = 12 * 1024 * 1024  # POST /api/apuntes con fileDataUrl (clientes antiguos)
MAX_DRAIN_BYTES = 32 * 1024 * 1024       # cuerpos mayores se cortan sin leerlos

# Los apuntes del seed no se pueden sobrescribir desde la API.
SEED_APUNTE_IDS = {"AP-01", "AP-02", "AP-03", "AP-04", "AP-05", "AP-06"}
APUNTE_ID_RE = re.compile(r"^AP-UP-[A-Z0-9]{4,32}$")
APUNTE_FILE_RE = re.compile(r"^/api/apuntes/([A-Za-z0-9_-]{1,64})/file$")

# Cuentas de demostración (seed): no se pueden borrar desde la API pública.
PROTECTED_ACCOUNTS = {
    "noeliacantador@itutor.es",
    "paulagarcia@itutor.es",
    "elenaramos@itutor.es",
    "carlosmendez@itutor.es",
    "profesor@itutor.es",
}


def compute_salted_hash(password: str, salt: str) -> str:
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 1024).hex()[:16]
    return f"$2b$12${salt}${digest}"


def connect():
    """Conexión SQLite con espera ante bloqueos (varias peticiones escriben a la vez)."""
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    return conn


def decode_data_url(url: str):
    """Devuelve (mime, bytes) de un data URL base64, o None si no es válido."""
    m = re.match(r"^data:([\w.+/-]*)((?:;[^,;]*)*),(.*)$", url or "", re.S)
    if not m or ";base64" not in m.group(2):
        return None
    try:
        return (m.group(1) or "application/octet-stream"), base64.b64decode(m.group(3), validate=False)
    except (binascii.Error, ValueError):
        return None


def save_apunte_file(c, apunte_id: str, mime: str, data: bytes):
    """Guarda (o reemplaza) el PDF de un apunte. Idempotente: reintentar no duplica."""
    digest = hashlib.sha256(data).hexdigest()
    c.execute(
        "INSERT OR REPLACE INTO apunte_files (id, mime, size, sha256, data, uploadedAt) VALUES (?,?,?,?,?,?)",
        (apunte_id, mime, len(data), digest, sqlite3.Binary(data), datetime.now().isoformat()),
    )
    return digest


def init_db():
    conn = connect()
    # WAL: las lecturas no bloquean mientras se escribe un PDF.
    conn.execute("PRAGMA journal_mode=WAL")
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            email TEXT PRIMARY KEY,
            name TEXT,
            role TEXT,
            salt TEXT,
            passwordHash TEXT
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT,
            email TEXT,
            matricula TEXT,
            tarifaHora REAL,
            plan TEXT,
            asignaturaPrincipal TEXT,
            profesorAsignado TEXT,
            saldoPendiente REAL,
            horasTotales INTEGER,
            telefono TEXT,
            estado TEXT
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS teachers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT,
            email TEXT,
            especialidad TEXT,
            departamento TEXT,
            tarifaHora REAL,
            alumnosAsignados TEXT,
            alumnosCount INTEGER,
            horasImpartidas INTEGER,
            totalGanado REAL,
            calificacion REAL,
            telefono TEXT,
            estado TEXT
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            _id TEXT PRIMARY KEY,
            estudianteId INTEGER,
            estudianteNombre TEXT,
            materia TEXT,
            rama TEXT,
            tutor TEXT,
            fecha TEXT,
            mes TEXT,
            duracionMin INTEGER,
            importe REAL,
            estado TEXT,
            asistencia INTEGER,
            notasSeguimiento TEXT
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS apuntes (
            id TEXT PRIMARY KEY,
            title TEXT,
            subject TEXT,
            teacher TEXT,
            date TEXT,
            size TEXT,
            pages INTEGER,
            summary TEXT,
            fileName TEXT,
            fileDataUrl TEXT
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            sender TEXT,
            recipient TEXT,
            text TEXT,
            ts INTEGER
        )
    """)

    # Poblar cuentas de autenticación (con Salt + Hash, sin contraseñas en texto plano)
    c.execute("SELECT COUNT(*) FROM users")
    if c.fetchone()[0] == 0:
        users_seed = [
            ("noeliacantador@itutor.es", "Noelia Cantador", "Admin", "salt_admin_2026", "$2b$12$salt_admin_2026$e7a1a9c54a7ded93"),
            ("paulagarcia@itutor.es", "Paula García", "Standard", "salt_student_2026", "$2b$12$salt_student_2026$3d1b2dc58c0ca993"),
            ("elenaramos@itutor.es", "Elena Ramos", "Teacher", "salt_teacher_2026", "$2b$12$salt_teacher_2026$a8be79c5c8293d93"),
            ("carlosmendez@itutor.es", "Prof. Carlos Méndez", "Teacher", "salt_carlos_2026", "$2b$12$salt_carlos_2026$d7e605c5c10bc993"),
            ("profesor@itutor.es", "Elena Ramos (Demo Profesor)", "Teacher", "salt_profe_2026", "$2b$12$salt_profe_2026$77cd5dc5eb524993")
        ]
        c.executemany("INSERT INTO users VALUES (?,?,?,?,?)", users_seed)

    c.execute("SELECT COUNT(*) FROM students")
    if c.fetchone()[0] == 0:
        students_seed = [
            (101, "Marcos Vega Ortiz", "marcosvega@itutor.es", "MAT-2026-041", 30, "Intensivo", "Física Clásica & Mecánica", "Elena Ramos", 0, 18, "+34 600 111 222", "Al día"),
            (102, "Lucía Hernanz Sanz", "luciahernanz@itutor.es", "MAT-2026-089", 35, "Premium", "Cálculo Multivariable II", "Prof. Carlos Méndez", 70, 22, "+34 600 222 333", "Pendiente"),
            (103, "Alejandro Gómez Soto", "alejandrogomez@itutor.es", "MAT-2026-112", 30, "Básico", "Termodinámica & Fluidos", "Dr. Miguel Ángel Santos", 0, 15, "+34 600 333 444", "Al día"),
            (104, "Sofía Navarro Cruz", "sofianavarro@itutor.es", "MAT-2026-145", 25, "Básico", "Álgebra Lineal & Geometría", "Prof. Carlos Méndez", 50, 12, "+34 600 444 555", "Pendiente"),
            (105, "Javier Domínguez Rey", "javierdominguez@itutor.es", "MAT-2026-178", 35, "Intensivo", "Electromagnetismo & Ondas", "Fernando Alonso", 0, 20, "+34 600 555 666", "Al día"),
            (106, "Clara Morales Ibáñez", "claramorales@itutor.es", "MAT-2026-203", 30, "Intensivo", "Ecuaciones Diferenciales", "Prof. Roberto Gil", 0, 16, "+34 600 666 777", "Al día"),
            (107, "David Romero Pascual", "davidromero@itutor.es", "MAT-2026-228", 28, "Básico", "Química Aplicada e Ingeniería", "Prof. Laura Vicente", 56, 10, "+34 600 777 888", "Pendiente"),
            (108, "Elena Ruiz Gallego", "elenaruiz@itutor.es", "MAT-2026-253", 32, "Premium", "Estadística & Análisis Numérico", "Carmen Delgado", 0, 24, "+34 600 888 999", "Al día"),
            (109, "Adrián Torres Molina", "adriantorres@itutor.es", "MAT-2026-279", 38, "Intensivo", "Mecánica Cuántica & Partículas", "Natalia Molina", 76, 14, "+34 600 999 000", "Pendiente"),
            (110, "Paula García Serrano", "paulagarcia@itutor.es", "MAT-2026-301", 35, "Premium", "Astrofísica & Cinemática", "Elena Ramos", 0, 26, "+34 611 000 111", "Al día")
        ]
        c.executemany("INSERT INTO students VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", students_seed)

    c.execute("SELECT COUNT(*) FROM teachers")
    if c.fetchone()[0] == 0:
        teachers_seed = [
            (201, "Elena Ramos", "elenaramos@itutor.es", "Física Teórica & Mecánica Clásica", "Física", 35, json.dumps(["Marcos Vega Ortiz", "Paula García Serrano"]), 2, 44, 1540, 4.9, "+34 611 223 344", "Activo"),
            (202, "Prof. Carlos Méndez", "carlosmendez@itutor.es", "Cálculo Multivariable & Álgebra Lineal", "Matemáticas", 35, json.dumps(["Lucía Hernanz Sanz", "Sofía Navarro Cruz"]), 2, 34, 1190, 4.8, "+34 622 334 455", "Activo"),
            (203, "Dr. Miguel Ángel Santos", "miguelsantos@itutor.es", "Termodinámica & Mecánica de Fluidos", "Física", 30, json.dumps(["Alejandro Gómez Soto"]), 1, 15, 450, 4.9, "+34 633 445 566", "Activo"),
            (204, "Prof. Laura Vicente", "lauravicente@itutor.es", "Química Aplicada e Ingeniería de Materiales", "Química", 28, json.dumps(["David Romero Pascual"]), 1, 10, 280, 4.7, "+34 644 556 677", "Activo"),
            (205, "Fernando Alonso", "fernandoalonso@itutor.es", "Electromagnetismo Avanzado & Circuitos", "Física", 35, json.dumps(["Javier Domínguez Rey"]), 1, 20, 700, 4.9, "+34 655 667 788", "Activo"),
            (206, "Carmen Delgado", "carmendelgado@itutor.es", "Estadística Aplicada & Probabilidad Bayesiana", "Matemáticas", 32, json.dumps(["Elena Ruiz Gallego"]), 1, 24, 768, 4.8, "+34 666 778 899", "Activo"),
            (207, "Prof. Roberto Gil", "robertogil@itutor.es", "Ecuaciones Diferenciales & Modelos Físicos", "Matemáticas", 30, json.dumps(["Clara Morales Ibáñez"]), 1, 16, 480, 4.6, "+34 677 889 900", "Activo"),
            (208, "Natalia Molina", "nataliamolina@itutor.es", "Física Cuántica & Partículas Subatómicas", "Física", 38, json.dumps(["Adrián Torres Molina"]), 1, 14, 532, 5.0, "+34 688 990 011", "Activo"),
            (209, "Prof. Jorge Herrera", "jorgeherrera@itutor.es", "Geometría Diferencial & Topología Espacial", "Matemáticas", 30, json.dumps(["Lucía Hernanz Sanz"]), 1, 12, 360, 4.7, "+34 699 001 122", "Disponible"),
            (210, "Patricia Serrano", "patriciaserrano@itutor.es", "Astrofísica, Óptica & Ondas Gravitacionales", "Física", 36, json.dumps(["Paula García Serrano"]), 1, 18, 648, 4.9, "+34 610 112 233", "Activo")
        ]
        c.executemany("INSERT INTO teachers VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", teachers_seed)

    c.execute("SELECT COUNT(*) FROM sessions")
    if c.fetchone()[0] == 0:
        sessions_seed = [
            ("654a1f9e2b1c8a001a111101", 101, "Marcos Vega Ortiz", "Física Clásica", "Física", "Elena Ramos", "2026-09-18 16:30", "septiembre", 90, 45, "Confirmada", 1, "Repaso de leyes de Newton y momento lineal."),
            ("654a1f9e2b1c8a001a111102", 102, "Lucía Hernanz Sanz", "Cálculo Multivariable", "Matemáticas", "Prof. Carlos Méndez", "2026-09-22 18:00", "septiembre", 90, 52.5, "Confirmada", 1, "Integrales dobles sobre regiones generales."),
            ("654a1f9e2b1c8a001a111104", 101, "Marcos Vega Ortiz", "Física Clásica", "Física", "Elena Ramos", "2026-10-02 16:30", "octubre", 90, 45, "Confirmada", 1, "Oscilaciones armónicas simples y amortiguadas."),
            ("654a1f9e2b1c8a001a111121", 110, "Paula García Serrano", "Ecuaciones Diferenciales", "Matemáticas", "Elena Ramos", "2026-10-10 17:00", "octubre", 90, 52.5, "Confirmada", 1, "Transformada de Laplace y problemas de valor inicial."),
            ("654a1f9e2b1c8a001a111109", 101, "Marcos Vega Ortiz", "Física Clásica", "Física", "Elena Ramos", "2026-11-06 16:30", "noviembre", 90, 45, "Confirmada", 1, "Dinámica del sólido rígido y tensor de inercia."),
            ("654a1f9e2b1c8a001a111112", 101, "Marcos Vega Ortiz", "Física Clásica", "Física", "Elena Ramos", "2026-12-02 16:30", "diciembre", 90, 45, "Confirmada", 1, "Preparación examen final de Mecánica Teórica.")
        ]
        c.executemany("INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", sessions_seed)

    c.execute("SELECT COUNT(*) FROM apuntes")
    if c.fetchone()[0] == 0:
        apuntes_seed = [
            ("AP-01", "Tema 4: Transformada de Laplace y EDOs de 2º Orden", "Ecuaciones Diferenciales", "Elena Ramos", "10 Oct 2026", "2.4 MB", 18, "Apuntes completos de la clase del 10 de octubre: tabla de transformadas, teoremas de traslación y 8 problemas de valor inicial resueltos paso a paso.", "Tema4_Laplace_iTUTOR.pdf", ""),
            ("AP-02", "Boletín Resuelto: EDOs Exactas y Factor Integrante", "Ecuaciones Diferenciales", "Elena Ramos", "03 Oct 2026", "1.9 MB", 14, "Colección de ejercicios de examen resueltos en pizarra digital durante la sesión de tutoría.", "Boletin_EDOs_Exactas.pdf", ""),
            ("AP-03", "Formulario: Integrales Dobles, Triples y Coordenadas Polares", "Cálculo Multivariable", "Prof. Carlos Méndez", "06 Oct 2026", "1.2 MB", 9, "Guía visual de recintos de integración, matriz Jacobiana y cambios de variable.", "Formulario_Integrales.pdf", ""),
            ("AP-04", "Guía Práctica: Diagonalización y Autovalores", "Álgebra Lineal", "Prof. Carlos Méndez", "28 Sep 2026", "3.1 MB", 22, "Polinomio característico, multiplicidad algebraica y geométrica, y aplicaciones a sistemas dinámicos.", "Guia_Diagonalizacion.pdf", ""),
            ("AP-05", "Recopilatorio de Exámenes Finales Resueltos (2023-2025)", "Ecuaciones Diferenciales", "Elena Ramos", "20 Sep 2026", "4.6 MB", 34, "Exámenes oficiales íntegramente comentados con trucos para identificar el método de resolución más rápido.", "Examenes_Finales_EDOs.pdf", ""),
            ("AP-06", "Planificación Personalizada del Curso — Paula García", "Coordinación", "Noelia Cantador", "12 Sep 2026", "0.8 MB", 5, "Hoja de ruta de objetivos académicos y calendario de evaluaciones para el primer cuatrimestre.", "Planificacion_Paula.pdf", "")
        ]
        c.executemany("INSERT INTO apuntes VALUES (?,?,?,?,?,?,?,?,?,?)", apuntes_seed)

    c.execute("SELECT COUNT(*) FROM messages")
    if c.fetchone()[0] == 0:
        messages_seed = [
            ("SEED-0", "noeliacantador@itutor.es", "paulagarcia@itutor.es", "¡Bienvenida a iTUTOR, Paula! Tu bono de tutorías de Octubre ya está confirmado.", 1790845200000),
            ("SEED-1", "elenaramos@itutor.es", "paulagarcia@itutor.es", "¡Hola Paula! Te he dejado subidos en 'Mis Apuntes' el PDF con los ejercicios sobre Transformada de Laplace.", 1791454500000),
            ("SEED-2", "paulagarcia@itutor.es", "elenaramos@itutor.es", "¡Muchas gracias Elena! Los estoy revisando ahora mismo. ¿En la clase del día 10 veremos también sistemas de EDOs?", 1791454680000),
            ("SEED-3", "elenaramos@itutor.es", "paulagarcia@itutor.es", "¡Sí! En los últimos 30 minutos resolveremos un sistema acoplado de 2º orden tipo examen. ¡Nos vemos en la Sala #04!", 1791454860000),
            ("SEED-4", "noeliacantador@itutor.es", "elenaramos@itutor.es", "Hola Elena, ¿cómo avanza el seguimiento de las tutorías de Física y Mecánica este mes?", 1793007000000),
            ("SEED-5", "elenaramos@itutor.es", "noeliacantador@itutor.es", "Buenos días Noelia. Todo marcha según el plan docente. Marcos y Paula están al día.", 1793009100000)
        ]
        c.executemany("INSERT INTO messages VALUES (?,?,?,?,?)", messages_seed)

    # Migración: columna con el email del profesor asignado (los alumnos registrados
    # desde la app la envían). Se añade DESPUÉS del seed porque este usa INSERT sin
    # lista de columnas.
    c.execute("PRAGMA table_info(students)")
    if "profesorEmail" not in [row[1] for row in c.fetchall()]:
        c.execute("ALTER TABLE students ADD COLUMN profesorEmail TEXT")

    # Migración apuntes: email del profesor que lo sube (decide qué alumnos lo ven).
    # Vacío = apunte compartido del seed (lo ven todos, como hasta ahora).
    c.execute("PRAGMA table_info(apuntes)")
    if "teacherEmail" not in [row[1] for row in c.fetchall()]:
        c.execute("ALTER TABLE apuntes ADD COLUMN teacherEmail TEXT DEFAULT ''")

    # Los PDFs viven en su propia tabla (BLOB): el listado de apuntes no arrastra
    # megabytes de base64 y el archivo se descarga aparte, en binario.
    c.execute("""
        CREATE TABLE IF NOT EXISTS apunte_files (
            id TEXT PRIMARY KEY,
            mime TEXT,
            size INTEGER,
            sha256 TEXT,
            data BLOB,
            uploadedAt TEXT
        )
    """)

    # Migración: PDFs guardados antes como data URL dentro de apuntes.fileDataUrl.
    c.execute("SELECT id, fileDataUrl FROM apuntes WHERE fileDataUrl IS NOT NULL AND fileDataUrl != ''")
    for legacy in c.fetchall():
        decoded = decode_data_url(legacy[1])
        if decoded and decoded[1]:
            save_apunte_file(c, legacy[0], decoded[0] if decoded[0] != "application/octet-stream" else "application/pdf", decoded[1])
        c.execute("UPDATE apuntes SET fileDataUrl='' WHERE id=?", (legacy[0],))

    conn.commit()
    conn.close()


def query_all(table_name):
    conn = connect()
    c = conn.cursor()
    c.execute(f"SELECT * FROM {table_name}")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    if table_name == "teachers":
        for r in rows:
            try:
                r["alumnosAsignados"] = json.loads(r["alumnosAsignados"])
            except Exception:
                r["alumnosAsignados"] = []
    elif table_name == "sessions":
        for r in rows:
            r["asistencia"] = bool(r["asistencia"])
    elif table_name == "messages":
        return [{"id": r["id"], "from": r["sender"], "to": r["recipient"], "text": r["text"], "ts": r["ts"]} for r in rows]
    return rows


def clean_text(value, max_len: int, default: str = "") -> str:
    text = str(value).strip() if value is not None else ""
    return (text or default)[:max_len]


def clean_pages(value) -> int:
    try:
        return max(1, min(5000, int(value)))
    except (TypeError, ValueError):
        return 1


def human_size(num_bytes: int) -> str:
    return f"{num_bytes / (1024 * 1024):.1f} MB" if num_bytes >= 1024 * 1024 else f"{max(1, round(num_bytes / 1024))} KB"


def store_apunte(c, meta: dict, data):
    """
    Alta/actualización de un apunte y, si llega, de su PDF. Devuelve (status, json).
    Es idempotente por id: el cliente puede reintentar sin crear duplicados.
    El que ya existe solo lo puede actualizar su propietario; los del seed son intocables.
    """
    apunte_id = clean_text(meta.get("id"), 64) or f"AP-UP-{secrets.token_hex(5).upper()}"
    if apunte_id in SEED_APUNTE_IDS:
        return 409, {"ok": False, "error": "PROTECTED_APUNTE"}
    if not APUNTE_ID_RE.match(apunte_id):
        return 400, {"ok": False, "error": "INVALID_ID"}

    if data is not None:
        if len(data) == 0:
            return 400, {"ok": False, "error": "EMPTY_FILE"}
        if len(data) > MAX_PDF_BYTES:
            return 413, {"ok": False, "error": "PAYLOAD_TOO_LARGE", "maxBytes": MAX_PDF_BYTES}
        # Solo PDFs reales: se comprueba la firma, no el nombre ni el tipo declarado.
        if not data.startswith(b"%PDF-"):
            return 415, {"ok": False, "error": "NOT_A_PDF"}

    owner = clean_text(meta.get("teacherEmail"), 120).lower()
    c.execute("SELECT teacherEmail FROM apuntes WHERE id = ?", (apunte_id,))
    existing = c.fetchone()
    if existing and (existing["teacherEmail"] or "") != owner:
        return 409, {"ok": False, "error": "NOT_OWNER"}

    file_name = os.path.basename(clean_text(meta.get("fileName"), 200, "apunte.pdf").replace("\\", "/")) or "apunte.pdf"
    size_label = human_size(len(data)) if data is not None else clean_text(meta.get("size"), 30, "-")
    c.execute(
        """
        INSERT INTO apuntes (id, title, subject, teacher, teacherEmail, date, size, pages, summary, fileName, fileDataUrl)
        VALUES (?,?,?,?,?,?,?,?,?,?,'')
        ON CONFLICT(id) DO UPDATE SET
            title=excluded.title, subject=excluded.subject, teacher=excluded.teacher,
            date=excluded.date, size=excluded.size, pages=excluded.pages,
            summary=excluded.summary, fileName=excluded.fileName
        """,
        (
            apunte_id,
            clean_text(meta.get("title"), 200, "Nuevo apunte"),
            clean_text(meta.get("subject"), 100, "Ecuaciones Diferenciales"),
            clean_text(meta.get("teacher"), 100, "Profesor/a"),
            owner,
            clean_text(meta.get("date"), 40) or datetime.now().strftime("%d %b %Y"),
            size_label,
            clean_pages(meta.get("pages")),
            clean_text(meta.get("summary"), 1000, f"Archivo subido: {file_name}"),
            file_name,
        ),
    )
    payload = {"ok": True, "id": apunte_id, "created": existing is None}
    if data is not None:
        payload["sha256"] = save_apunte_file(c, apunte_id, "application/pdf", data)
        payload["fileBytes"] = len(data)
    return (201 if existing is None else 200), payload


def apunte_visible_emails(c, viewer: str):
    """
    Emails de profesor cuyos apuntes puede ver `viewer`.
    Devuelve None si lo ve todo (administrador).
    Un alumno ve los apuntes de su profesor asignado; un profesor, los suyos.
    """
    c.execute("SELECT role FROM users WHERE email = ?", (viewer,))
    u = c.fetchone()
    if u and u["role"] == "Admin":
        return None
    emails = {viewer}
    c.execute("SELECT nombre, profesorEmail, profesorAsignado FROM students WHERE lower(email) = ?", (viewer,))
    st = c.fetchone()
    if st:
        if st["profesorEmail"]:
            emails.add(st["profesorEmail"].strip().lower())
        c.execute("SELECT nombre, email, alumnosAsignados FROM teachers")
        for t in c.fetchall():
            try:
                assigned = json.loads(t["alumnosAsignados"] or "[]")
            except Exception:  # noqa: BLE001
                assigned = []
            if t["nombre"] == st["profesorAsignado"] or st["nombre"] in assigned:
                emails.add((t["email"] or "").strip().lower())
    return emails


def list_apuntes(materia=None, viewer=None):
    """Metadatos de apuntes (sin el contenido del PDF), opcionalmente filtrados."""
    conn = connect()
    c = conn.cursor()
    visible = apunte_visible_emails(c, viewer) if viewer else None
    c.execute("""
        SELECT a.id, a.title, a.subject, a.teacher, a.teacherEmail, a.date, a.size, a.pages,
               a.summary, a.fileName, f.size AS fileBytes, f.sha256 AS sha256
        FROM apuntes a LEFT JOIN apunte_files f ON f.id = a.id
        ORDER BY a.rowid
    """)
    rows = c.fetchall()
    conn.close()
    out = []
    for r in rows:
        owner = (r["teacherEmail"] or "").strip().lower()
        # Sin dueño = apunte compartido del seed: lo ven todos.
        if visible is not None and owner and owner not in visible:
            continue
        if materia and materia != "Todos" and (r["subject"] or "").lower() != materia.lower():
            continue
        has_file = r["fileBytes"] is not None
        out.append({
            "id": r["id"],
            "title": r["title"],
            "subject": r["subject"],
            "teacher": r["teacher"],
            "teacherEmail": owner,
            "date": r["date"],
            "size": r["size"],
            "pages": r["pages"],
            "summary": r["summary"],
            "fileName": r["fileName"],
            "hasFile": has_file,
            "fileBytes": r["fileBytes"] if has_file else 0,
            "sha256": r["sha256"] or "",
            "fileUrl": f"/api/apuntes/{r['id']}/file" if has_file else "",
        })
    return out


class ITutorAPIHandler(BaseHTTPRequestHandler):
    # Un cliente lento o colgado no puede bloquear un hilo indefinidamente.
    timeout = 60

    def _set_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization, X-App-Client, X-Apunte-Meta, If-None-Match",
        )
        self.send_header("Access-Control-Expose-Headers", "Content-Disposition, ETag")

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors()
        self.end_headers()

    def _read_body(self, limit: int):
        """
        Lee el cuerpo respetando `limit`. Si lo supera responde 413 (tras vaciar el
        cuerpo para que el navegador reciba el 413 y no un corte de conexión).
        Devuelve bytes, o None si ya se ha respondido con un error.
        """
        try:
            length = int(self.headers.get("Content-Length", "0") or 0)
        except ValueError:
            self._send_json({"ok": False, "error": "BAD_CONTENT_LENGTH"}, 400)
            return None
        if length < 0:
            self._send_json({"ok": False, "error": "BAD_CONTENT_LENGTH"}, 400)
            return None
        if length > limit:
            if length <= MAX_DRAIN_BYTES:
                remaining = length
                while remaining > 0:
                    chunk = self.rfile.read(min(65536, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
            self.close_connection = True
            self._send_json({"ok": False, "error": "PAYLOAD_TOO_LARGE", "maxBytes": limit}, 413)
            return None
        data = self.rfile.read(length) if length > 0 else b""
        if len(data) != length:
            self._send_json({"ok": False, "error": "INCOMPLETE_BODY"}, 400)
            return None
        return data

    def _send_apunte_file(self, apunte_id: str, as_attachment: bool):
        conn = connect()
        c = conn.cursor()
        c.execute(
            "SELECT f.mime, f.size, f.sha256, f.data, a.fileName, a.title "
            "FROM apunte_files f LEFT JOIN apuntes a ON a.id = f.id WHERE f.id = ?",
            (apunte_id,),
        )
        row = c.fetchone()
        conn.close()
        if not row:
            self._send_json({"ok": False, "error": "FILE_NOT_FOUND"}, 404)
            return
        etag = f'"{row["sha256"]}"'
        if self.headers.get("If-None-Match") == etag:
            self.send_response(304)
            self._set_cors()
            self.send_header("ETag", etag)
            self.end_headers()
            return
        data = bytes(row["data"])
        name = row["fileName"] or f"{row['title'] or apunte_id}.pdf"
        # Nombre seguro en cabecera: ASCII de respaldo + filename* (RFC 5987) con tildes.
        ascii_name = re.sub(r"[^A-Za-z0-9._-]", "_", name.encode("ascii", "ignore").decode() or "apunte.pdf")
        disposition = "attachment" if as_attachment else "inline"
        self.send_response(200)
        self._set_cors()
        self.send_header("Content-Type", row["mime"] or "application/pdf")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Content-Disposition", f"{disposition}; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(name)}")
        self.send_header("ETag", etag)
        self.send_header("Cache-Control", "private, max-age=3600")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def _send_json(self, data, status=200):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._set_cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path == "/api/status":
            self._send_json({
                "status": "online",
                "server": "Banana Pi M2 Berry (ARMv7 Linux)",
                "hostname": socket.gethostname(),
                "database": "SQLite3 (itutor.db)",
                "timestamp": datetime.now().isoformat(),
                "counts": {
                    "users": len(query_all("users")),
                    "students": len(query_all("students")),
                    "teachers": len(query_all("teachers")),
                    "sessions": len(query_all("sessions")),
                    "apuntes": len(query_all("apuntes")),
                    "messages": len(query_all("messages")),
                }
            })
            return

        if path == "/api/users":
            # Nunca se exponen salt ni passwordHash por la API pública.
            self._send_json([
                {"email": u["email"], "name": u["name"], "role": u["role"]}
                for u in query_all("users")
            ])
            return

        if path == "/api/students":
            self._send_json(query_all("students"))
            return

        if path == "/api/teachers":
            self._send_json(query_all("teachers"))
            return

        if path == "/api/sessions":
            self._send_json(query_all("sessions"))
            return

        if path == "/api/messages":
            self._send_json(query_all("messages"))
            return

        if path == "/api/apuntes":
            # Solo metadatos (el PDF se pide aparte). `viewer` limita a los apuntes
            # del profesor asignado a ese alumno (o los propios si es profesor).
            viewer = (qs.get("viewer", [""])[0] or "").strip().lower() or None
            self._send_json(list_apuntes(qs.get("materia", [None])[0], viewer))
            return

        file_match = APUNTE_FILE_RE.match(path)
        if file_match:
            self._send_apunte_file(file_match.group(1), qs.get("download", ["0"])[0] == "1")
            return

        if path == "/api/export/csv":
            tipo = qs.get("tipo", ["sesiones"])[0].lower()
            output = io.StringIO()
            output.write("\ufeff")
            writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

            if tipo == "alumnos":
                writer.writerow(["ID", "Matricula", "Nombre", "Email", "AsignaturaPrincipal", "Plan", "ProfesorAsignado", "TarifaHora", "SaldoPendiente", "HorasTotales", "Telefono", "Estado"])
                for s in query_all("students"):
                    writer.writerow([s["id"], s["matricula"], s["nombre"], s["email"], s["asignaturaPrincipal"], s["plan"], s["profesorAsignado"], s["tarifaHora"], s["saldoPendiente"], s["horasTotales"], s["telefono"], s["estado"]])
                filename = f"iTUTOR_Alumnos_{datetime.now().strftime('%Y-%m-%d')}.csv"
            elif tipo == "profesores":
                writer.writerow(["ID", "Nombre", "Email", "Especialidad", "Departamento", "AlumnosCount", "HorasImpartidas", "TarifaHora", "TotalGanado", "Telefono", "Estado"])
                for t in query_all("teachers"):
                    writer.writerow([t["id"], t["nombre"], t["email"], t["especialidad"], t["departamento"], t["alumnosCount"], t["horasImpartidas"], t["tarifaHora"], t["totalGanado"], t["telefono"], t["estado"]])
                filename = f"iTUTOR_Profesores_{datetime.now().strftime('%Y-%m-%d')}.csv"
            elif tipo == "apuntes":
                writer.writerow(["ID", "Titulo", "Asignatura", "Profesor", "Fecha", "Tamano", "Paginas", "Resumen"])
                for a in query_all("apuntes"):
                    writer.writerow([a["id"], a["title"], a["subject"], a["teacher"], a["date"], a["size"], a["pages"], a["summary"]])
                filename = f"iTUTOR_Apuntes_{datetime.now().strftime('%Y-%m-%d')}.csv"
            else:
                writer.writerow(["ID", "Estudiante", "Materia", "Rama", "Tutor", "Fecha", "Mes", "DuracionMin", "Importe", "Estado", "Asistencia", "Notas"])
                for s in query_all("sessions"):
                    writer.writerow([s["_id"], s["estudianteNombre"], s["materia"], s["rama"], s["tutor"], s["fecha"], s["mes"], s["duracionMin"], s["importe"], s["estado"], "Sí" if s["asistencia"] else "No", s["notasSeguimiento"]])
                filename = f"iTUTOR_Sesiones_{datetime.now().strftime('%Y-%m-%d')}.csv"

            csv_bytes = output.getvalue().encode("utf-8")
            self.send_response(200)
            self._set_cors()
            self.send_header("Content-Type", "text/csv; charset=utf-8")
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
            self.send_header("Content-Length", str(len(csv_bytes)))
            self.end_headers()
            self.wfile.write(csv_bytes)
            return

        # Panel visual HTML en la raíz "/"
        apuntes = query_all("apuntes")
        sessions = query_all("sessions")
        students = query_all("students")
        teachers = query_all("teachers")
        users = query_all("users")
        messages = query_all("messages")

        # Todo lo que viene de usuarios se escapa: un título con <script> no debe ejecutarse.
        e = lambda v: html_lib.escape(str(v if v is not None else ""))  # noqa: E731
        apuntes_rows = "".join(
            f"<tr><td><code>{e(a['id'])}</code></td><td><b>{e(a['title'])}</b></td><td>{e(a['subject'])}</td><td>{e(a['teacher'])}</td><td>{e(a['date'])}</td><td>{e(a['size'])}</td></tr>"
            for a in apuntes
        )
        sessions_rows = "".join(
            f"<tr><td>{e(s['estudianteNombre'])}</td><td>{e(s['materia'])}</td><td>{e(s['tutor'])}</td><td>{e(s['fecha'])}</td><td>{e(s['importe'])} €</td><td><span class='badge'>{e(s['estado'])}</span></td></tr>"
            for s in sessions
        )
        messages_rows = "".join(
            f"<tr><td><code>{e(m['from'])}</code></td><td><code>{e(m['to'])}</code></td><td>{e(m['text'])}</td></tr>"
            for m in messages[-8:]
        )

        html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>iTUTOR Backend API — Banana Pi M2 Berry</title>
  <style>
    body {{ font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }}
    .container {{ max-width: 1050px; margin: 0 auto; }}
    .header {{ background: linear-gradient(135deg, #1e293b, #0f172a); border: 1px solid #334155; border-radius: 14px; padding: 22px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }}
    .status-pill {{ background: #065f46; color: #6ee7b7; padding: 6px 14px; border-radius: 999px; font-weight: 600; font-size: 0.85rem; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }}
    .card {{ background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 18px; margin-bottom: 20px; }}
    .card h3 {{ margin: 0 0 8px; font-size: 0.85rem; color: #94a3b8; }}
    .card .num {{ font-size: 1.8rem; font-weight: 700; color: #38bdf8; }}
    .btn {{ display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; font-size: 0.88rem; margin-right: 8px; margin-bottom: 8px; border: none; cursor: pointer; }}
    .btn-green {{ background: #059669; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 0.9rem; }}
    th, td {{ text-align: left; padding: 10px 12px; border-bottom: 1px solid #334155; }}
    th {{ color: #94a3b8; font-weight: 600; background: #0f172a; }}
    .badge {{ background: #1d4ed8; color: #dbeafe; padding: 3px 8px; border-radius: 6px; font-size: 0.78rem; }}
    input, select {{ background: #0f172a; border: 1px solid #475569; color: white; padding: 8px 12px; border-radius: 6px; margin-right: 8px; margin-bottom: 8px; }}
    code {{ color: #fbbf24; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1 style="margin:0 0 6px; font-size: 1.5rem;">🍓 Servidor Backend iTUTOR — Banana Pi M2 Berry</h1>
        <div style="color:#94a3b8; font-size:0.9rem;">Host: <code>{socket.gethostname()}</code> | IP Local: <code>192.168.1.47:3000</code> | NAT WAN: <code>88.26.12.64:3000</code> | DB: <code>SQLite3 (itutor.db)</code></div>
      </div>
      <div class="status-pill">● API & NAT ONLINE</div>
    </div>

    <div class="grid">
      <div class="card"><h3>Usuarios Auth</h3><div class="num">{len(users)}</div><a href="/api/users" style="color:#38bdf8;font-size:0.8rem;">Ver JSON →</a></div>
      <div class="card"><h3>Alumnos</h3><div class="num">{len(students)}</div><a href="/api/students" style="color:#38bdf8;font-size:0.8rem;">Ver JSON →</a></div>
      <div class="card"><h3>Profesores</h3><div class="num">{len(teachers)}</div><a href="/api/teachers" style="color:#38bdf8;font-size:0.8rem;">Ver JSON →</a></div>
      <div class="card"><h3>Sesiones</h3><div class="num">{len(sessions)}</div><a href="/api/sessions" style="color:#38bdf8;font-size:0.8rem;">Ver JSON →</a></div>
      <div class="card"><h3>Apuntes</h3><div class="num">{len(apuntes)}</div><a href="/api/apuntes" style="color:#38bdf8;font-size:0.8rem;">Ver JSON →</a></div>
      <div class="card"><h3>Mensajes Chat</h3><div class="num">{len(messages)}</div><a href="/api/messages" style="color:#38bdf8;font-size:0.8rem;">Ver JSON →</a></div>
    </div>

    <div class="card">
      <h2 style="margin-top:0; font-size: 1.15rem;">📊 Generación Dinámica de CSV desde la API</h2>
      <a class="btn btn-green" href="/api/export/csv?tipo=sesiones">⬇ Descargar CSV Sesiones</a>
      <a class="btn btn-green" href="/api/export/csv?tipo=apuntes">⬇ Descargar CSV Apuntes</a>
      <a class="btn btn-green" href="/api/export/csv?tipo=alumnos">⬇ Descargar CSV Alumnos</a>
      <a class="btn btn-green" href="/api/export/csv?tipo=profesores">⬇ Descargar CSV Profesores</a>
    </div>

    <div class="card">
      <h2 style="margin-top:0; font-size: 1.15rem;">💬 Mensajería en Tiempo Real Elena ↔ Paula (POST /api/messages)</h2>
      <table>
        <thead><tr><th>De (Emisor)</th><th>Para (Receptor)</th><th>Mensaje</th></tr></thead>
        <tbody>{messages_rows}</tbody>
      </table>
    </div>

    <div class="card">
      <h2 style="margin-top:0; font-size: 1.15rem;">📚 Apuntes Académicos en Base de Datos (POST /api/apuntes)</h2>
      <table>
        <thead><tr><th>ID</th><th>Título</th><th>Asignatura</th><th>Profesor</th><th>Fecha</th><th>Tamaño</th></tr></thead>
        <tbody>{apuntes_rows}</tbody>
      </table>
    </div>
  </div>
</body>
</html>"""
        payload = html.encode("utf-8")
        self.send_response(200)
        self._set_cors()
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_PUT(self):
        try:
            self._handle_put()
        except Exception as exc:  # noqa: BLE001
            print(f"[ERROR] PUT {self.path}: {exc!r}")
            try:
                self._send_json({"ok": False, "error": "SERVER_ERROR", "detail": str(exc)}, 500)
            except Exception:  # noqa: BLE001
                pass

    def _handle_put(self):
        """PUT /api/apuntes/<id>/file: PDF en binario + metadatos en X-Apunte-Meta (JSON con encodeURIComponent)."""
        path = urlparse(self.path).path
        match = APUNTE_FILE_RE.match(path)
        if not match:
            self._send_json({"error": "Endpoint no encontrado"}, 404)
            return
        try:
            meta = json.loads(unquote(self.headers.get("X-Apunte-Meta", "") or "{}"))
        except Exception:  # noqa: BLE001
            meta = None
        if not isinstance(meta, dict):
            self._send_json({"ok": False, "error": "INVALID_META"}, 400)
            return
        meta["id"] = match.group(1)  # el id manda la URL, no la cabecera

        data = self._read_body(MAX_PDF_BYTES)
        if data is None:
            return
        # Todo en una transacción: o quedan apunte + PDF, o no queda nada.
        conn = connect()
        try:
            status, payload = store_apunte(conn.cursor(), meta, data)
            if payload.get("ok"):
                conn.commit()
            else:
                conn.rollback()
        finally:
            conn.close()
        self._send_json(payload, status)

    def do_POST(self):
        # Cualquier error inesperado se devuelve como JSON 500 (antes el cliente
        # recibía una conexión cortada y no podía saber que el guardado falló).
        try:
            self._handle_post()
        except Exception as exc:  # noqa: BLE001
            print(f"[ERROR] POST {self.path}: {exc!r}")
            try:
                self._send_json({"ok": False, "error": "SERVER_ERROR", "detail": str(exc)}, 500)
            except Exception:  # noqa: BLE001
                pass

    def _handle_post(self):
        parsed = urlparse(self.path)
        path = parsed.path
        raw = self._read_body(MAX_LEGACY_JSON_BYTES if path == "/api/apuntes" else MAX_JSON_BYTES)
        if raw is None:
            return
        try:
            body = json.loads(raw.decode("utf-8")) if raw else {}
        except Exception:  # noqa: BLE001
            body = {}
        if not isinstance(body, dict):
            body = {}

        conn = connect()
        c = conn.cursor()

        if path == "/api/auth/salt":
            # Permite al cliente saber si una cuenta existe y con qué salt calcular
            # el hash (la contraseña nunca viaja). Sirve para iniciar sesión en un
            # dispositivo distinto del que se usó para registrarse.
            email = (body.get("email") or "").strip().lower()
            c.execute("SELECT salt FROM users WHERE email = ?", (email,))
            row = c.fetchone()
            conn.close()
            if not row:
                self._send_json({"ok": False, "error": "NOT_FOUND"}, 404)
                return
            self._send_json({"ok": True, "salt": row["salt"]}, 200)
            return

        if path == "/api/auth/login":
            email = (body.get("email") or "").strip().lower()
            passwordHash = body.get("passwordHash")
            c.execute("SELECT * FROM users WHERE email = ?", (email,))
            row = c.fetchone()
            conn.close()
            # El hash es OBLIGATORIO: antes, omitirlo permitía entrar sin contraseña.
            if not row or not passwordHash or row["passwordHash"] != passwordHash:
                self._send_json({"ok": False, "error": "INVALID_CREDENTIALS"}, 401)
                return
            user = dict(row)
            self._send_json({
                "ok": True,
                "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.iTUTOR_BANANAPI.signature",
                "user": {"email": user["email"], "name": user["name"], "role": user["role"]}
            }, 200)
            return

        if path == "/api/auth/register":
            email = (body.get("email") or "").strip().lower()
            name = body.get("name") or "Nuevo Usuario"
            role = body.get("role", "Standard")
            salt = body.get("salt")
            passwordHash = body.get("passwordHash")
            if "@" not in email or not salt or not passwordHash:
                conn.close()
                self._send_json({"ok": False, "error": "INVALID_DATA"}, 400)
                return
            # El rol Admin solo existe por seed: no se puede crear desde la API pública.
            if role not in ("Standard", "Teacher"):
                conn.close()
                self._send_json({"ok": False, "error": "INVALID_ROLE"}, 400)
                return
            c.execute("SELECT 1 FROM users WHERE email = ?", (email,))
            if c.fetchone():
                # No se sobrescribe jamás una cuenta existente (antes INSERT OR REPLACE
                # permitía pisar la contraseña de otro usuario).
                conn.close()
                self._send_json({"ok": False, "error": "EMAIL_ALREADY_EXISTS"}, 409)
                return
            c.execute("INSERT INTO users VALUES (?,?,?,?,?)", (email, name, role, salt, passwordHash))
            conn.commit()
            conn.close()
            self._send_json({
                "ok": True,
                "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.iTUTOR_BANANAPI.signature",
                "user": {"email": email, "name": name, "role": role}
            }, 201)
            return

        if path == "/api/auth/delete":
            email = (body.get("email") or "").strip().lower()
            passwordHash = body.get("passwordHash")
            if email in PROTECTED_ACCOUNTS:
                conn.close()
                self._send_json({"ok": False, "error": "PROTECTED_ACCOUNT"}, 403)
                return
            c.execute("SELECT passwordHash FROM users WHERE email = ?", (email,))
            row = c.fetchone()
            if not row or not passwordHash or row["passwordHash"] != passwordHash:
                conn.close()
                self._send_json({"ok": False, "error": "INVALID_CREDENTIALS"}, 401)
                return
            c.execute("DELETE FROM users WHERE email = ?", (email,))
            c.execute("DELETE FROM students WHERE lower(email) = ?", (email,))
            c.execute("DELETE FROM teachers WHERE lower(email) = ?", (email,))
            conn.commit()
            conn.close()
            self._send_json({"ok": True}, 200)
            return

        if path == "/api/messages":
            msg_id = body.get("id") or f"MSG-{int(datetime.now().timestamp() * 1000)}"
            sender = (body.get("from") or "elenaramos@itutor.es").strip().lower()
            recipient = (body.get("to") or "paulagarcia@itutor.es").strip().lower()
            text = body.get("text", "")
            ts = int(body.get("ts") or int(datetime.now().timestamp() * 1000))
            c.execute("INSERT OR REPLACE INTO messages VALUES (?,?,?,?,?)", (msg_id, sender, recipient, text, ts))
            conn.commit()
            conn.close()
            self._send_json({"ok": True, "id": msg_id}, 201)
            return

        if path == "/api/apuntes":
            # Compatibilidad: alta de apunte en JSON, con el PDF opcional como data URL.
            # El cliente actual sube el PDF en binario con PUT /api/apuntes/<id>/file.
            data = None
            data_url = body.get("fileDataUrl") or ""
            if data_url:
                decoded = decode_data_url(data_url)
                if not decoded or not decoded[1]:
                    conn.close()
                    self._send_json({"ok": False, "error": "INVALID_FILE"}, 400)
                    return
                data = decoded[1]
            status, payload = store_apunte(c, body, data)
            if payload.get("ok"):
                conn.commit()
            conn.close()
            self._send_json(payload, status)
            return

        if path == "/api/sessions":
            new_id = body.get("_id") or f"ses_{int(datetime.now().timestamp())}"
            est_id = int(body.get("estudianteId", 110))
            est_nombre = body.get("estudianteNombre", "Paula García Serrano")
            materia = body.get("materia", "Física Clásica")
            rama = body.get("rama", "Física")
            tutor = body.get("tutor", "Elena Ramos")
            fecha = body.get("fecha") or datetime.now().strftime("%Y-%m-%d %H:%M")
            mes = body.get("mes", "octubre")
            duracion = int(body.get("duracionMin", 90))
            importe = float(body.get("importe", 45))
            estado = body.get("estado", "Confirmada")
            asistencia = 1 if body.get("asistencia", True) else 0
            notas = body.get("notasSeguimiento", "Sesión registrada en servidor Banana Pi.")

            c.execute(
                "INSERT OR REPLACE INTO sessions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (new_id, est_id, est_nombre, materia, rama, tutor, fecha, mes, duracion, importe, estado, asistencia, notas)
            )
            conn.commit()
            conn.close()
            self._send_json({"ok": True, "_id": new_id}, 201)
            return

        if path == "/api/students":
            # Alta/actualización idempotente por email: el cliente puede reintentar
            # el envío sin crear alumnos duplicados.
            nombre = body.get("nombre", "Nuevo Alumno")
            email = (body.get("email") or "alumno@itutor.es").strip().lower()
            matricula = body.get("matricula") or f"MAT-2026-{int(datetime.now().timestamp()) % 1000}"
            tarifa = float(body.get("tarifaHora", 30))
            plan = body.get("plan", "Básico")
            asignatura = body.get("asignaturaPrincipal", "Física Clásica")
            profesor = body.get("profesorAsignado", "Elena Ramos")
            profesor_email = (body.get("profesorEmail") or "").strip().lower() or None
            c.execute("SELECT id FROM students WHERE lower(email) = ?", (email,))
            existing = c.fetchone()
            if existing:
                c.execute(
                    "UPDATE students SET nombre=?, matricula=?, tarifaHora=?, plan=?, asignaturaPrincipal=?, profesorAsignado=?, profesorEmail=? WHERE id=?",
                    (nombre, matricula, tarifa, plan, asignatura, profesor, profesor_email, existing["id"])
                )
            else:
                c.execute(
                    "INSERT INTO students (nombre,email,matricula,tarifaHora,plan,asignaturaPrincipal,profesorAsignado,saldoPendiente,horasTotales,telefono,estado,profesorEmail) VALUES (?,?,?,?,?,?,?,0,0,'-','Activo',?)",
                    (nombre, email, matricula, tarifa, plan, asignatura, profesor, profesor_email)
                )
            conn.commit()
            conn.close()
            self._send_json({"ok": True}, 201)
            return

        if path == "/api/teachers":
            nombre = body.get("nombre", "Nuevo Profesor")
            email = (body.get("email") or "profesor@itutor.es").strip().lower()
            especialidad = body.get("especialidad", "")
            departamento = body.get("departamento", "Matemáticas")
            tarifa = float(body.get("tarifaHora", 30))
            c.execute("SELECT id FROM teachers WHERE lower(email) = ?", (email,))
            existing = c.fetchone()
            if existing:
                c.execute(
                    "UPDATE teachers SET nombre=?, especialidad=?, departamento=?, tarifaHora=? WHERE id=?",
                    (nombre, especialidad, departamento, tarifa, existing["id"])
                )
            else:
                c.execute(
                    "INSERT INTO teachers (nombre,email,especialidad,departamento,tarifaHora,alumnosAsignados,alumnosCount,horasImpartidas,totalGanado,calificacion,telefono,estado) VALUES (?,?,?,?,?,?,0,0,0,5,'-','Disponible')",
                    (nombre, email, especialidad, departamento, tarifa, json.dumps(body.get("alumnosAsignados") or []))
                )
            conn.commit()
            conn.close()
            self._send_json({"ok": True}, 201)
            return

        conn.close()
        self._send_json({"error": "Endpoint no encontrado"}, 404)


if __name__ == "__main__":
    init_db()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), ITutorAPIHandler)
    print(f"============================================================")
    print(f" 🍓 Servidor API REST + SQLite iTUTOR activo en puerto {PORT}")
    print(f" 🌐 Local:   http://192.168.1.47:{PORT}")
    print(f" 🚀 Público: http://88.26.12.64:{PORT}")
    print(f" 📂 Base de datos: {DB_PATH}")
    print(f"============================================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
