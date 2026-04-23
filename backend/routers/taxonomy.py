# routers/taxonomy.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional  # <-- Add Optional here

from database.database import get_db
from schemas import taxonomy as taxonomy_schemas
from crud import crud_taxonomy

router = APIRouter(prefix="/taxonomy", tags=["Taxonomy (Unipd Map)"])

# --- DEPARTMENTS ---
@router.get("/departments", response_model=List[taxonomy_schemas.DepartmentResponse])
def read_departments(search: Optional[str] = None, db: Session = Depends(get_db)):
    """Fetch all departments, or search by name."""
    return crud_taxonomy.get_departments(db, search=search)

@router.post("/departments", response_model=taxonomy_schemas.DepartmentResponse, status_code=status.HTTP_201_CREATED)
def create_department(department: taxonomy_schemas.DepartmentCreate, db: Session = Depends(get_db)):
    """Create a department."""
    existing = crud_taxonomy.get_department_by_name(db, name=department.name)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department already exists")
    return crud_taxonomy.create_department(db, department=department)

# --- PROGRAMS ---
@router.get("/programs", response_model=List[taxonomy_schemas.ProgramResponse])
def read_programs(department_id: Optional[int] = None, search: Optional[str] = None, db: Session = Depends(get_db)):
    """Fetch programs. Filter by department ID, or search by name."""
    return crud_taxonomy.get_programs(db, department_id=department_id, search=search)

@router.post("/programs", response_model=taxonomy_schemas.ProgramResponse, status_code=status.HTTP_201_CREATED)
def create_program(program: taxonomy_schemas.ProgramCreate, db: Session = Depends(get_db)):
    """Create a program under a department."""
    department = crud_taxonomy.get_department(db, department_id=program.department_id)
    if not department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    existing = crud_taxonomy.get_program_by_name(db, name=program.name)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Program already exists")
    return crud_taxonomy.create_program(db, program=program)

# --- SUBJECTS ---
@router.get("/subjects", response_model=List[taxonomy_schemas.SubjectResponse])
def read_subjects(search: Optional[str] = None, db: Session = Depends(get_db)):
    """Fetch all subjects, or search by name."""
    return crud_taxonomy.get_subjects(db, search=search)

@router.post("/subjects", response_model=taxonomy_schemas.SubjectResponse, status_code=status.HTTP_201_CREATED)
def create_subject(subject: taxonomy_schemas.SubjectCreate, db: Session = Depends(get_db)):
    """Create a subject."""
    existing = crud_taxonomy.get_subject_by_name(db, name=subject.name)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Subject already exists")
    return crud_taxonomy.create_subject(db, subject=subject)


@router.post("/programs/{p_id}/subjects/{s_id}", response_model=taxonomy_schemas.ProgramResponse)
def link_subject_to_program(p_id: int, s_id: int, db: Session = Depends(get_db)):
    """Link an existing subject to an existing program."""
    program = crud_taxonomy.get_program(db, program_id=p_id)
    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")

    subject = crud_taxonomy.get_subject(db, subject_id=s_id)
    if not subject:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")

    return crud_taxonomy.link_program_subject(db, program=program, subject=subject)
