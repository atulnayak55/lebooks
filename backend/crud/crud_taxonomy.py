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

def get_department_by_name(db: Session, name: str):
    return db.query(models.Department).filter(models.Department.name == name).first()


def get_department(db: Session, department_id: int):
    return db.query(models.Department).filter(models.Department.id == department_id).first()


def get_program_by_name(db: Session, name: str):
    return db.query(models.Program).filter(models.Program.name == name).first()


def get_subject_by_name(db: Session, name: str):
    return db.query(models.Subject).filter(models.Subject.name == name).first()


def get_program(db: Session, program_id: int):
    return db.query(models.Program).filter(models.Program.id == program_id).first()


def get_subject(db: Session, subject_id: int):
    return db.query(models.Subject).filter(models.Subject.id == subject_id).first()


# --- SETTERS ---
def create_department(db: Session, department: taxonomy_schemas.DepartmentCreate):
    db_department = models.Department(name=department.name)
    db.add(db_department)
    db.commit()
    db.refresh(db_department)
    return db_department


def create_program(db: Session, program: taxonomy_schemas.ProgramCreate):
    db_program = models.Program(name=program.name, department_id=program.department_id)
    db.add(db_program)
    db.commit()
    db.refresh(db_program)
    return db_program


def create_subject(db: Session, subject: taxonomy_schemas.SubjectCreate):
    db_subject = models.Subject(name=subject.name)
    db.add(db_subject)
    db.commit()
    db.refresh(db_subject)
    return db_subject


def link_program_subject(db: Session, program: models.Program, subject: models.Subject):
    if subject not in program.subjects:
        program.subjects.append(subject)
        db.commit()
        db.refresh(program)
    return program
