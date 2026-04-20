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

# ... your POST /departments route stays here ...

# --- PROGRAMS ---
@router.get("/programs", response_model=List[taxonomy_schemas.ProgramResponse])
def read_programs(department_id: Optional[int] = None, search: Optional[str] = None, db: Session = Depends(get_db)):
    """Fetch programs. Filter by department ID, or search by name."""
    return crud_taxonomy.get_programs(db, department_id=department_id, search=search)

# ... your POST /programs route stays here ...

# --- SUBJECTS ---
@router.get("/subjects", response_model=List[taxonomy_schemas.SubjectResponse])
def read_subjects(search: Optional[str] = None, db: Session = Depends(get_db)):
    """Fetch all subjects, or search by name."""
    return crud_taxonomy.get_subjects(db, search=search)

# ... keep the rest of your POST and Link routes below ...