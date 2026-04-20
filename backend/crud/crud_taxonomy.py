# crud/crud_taxonomy.py
from sqlalchemy.orm import Session
from database import models
from schemas import taxonomy as taxonomy_schemas

# --- GETTERS ---
def get_departments(db: Session, search: str = None):
    query = db.query(models.Department)
    # If the user typed a search term, filter the results!
    if search:
        query = query.filter(models.Department.name.ilike(f"%{search}%"))
    return query.all()

def get_programs(db: Session, department_id: int = None, search: str = None):
    query = db.query(models.Program)
    if department_id:
        query = query.filter(models.Program.department_id == department_id)
    if search:
        query = query.filter(models.Program.name.ilike(f"%{search}%"))
    return query.all()

def get_subjects(db: Session, search: str = None):
    query = db.query(models.Subject)
    if search:
        query = query.filter(models.Subject.name.ilike(f"%{search}%"))
    return query.all()

# ... keep your SETTERS exactly as they are below this