from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta, timezone

# --- PASSWORD HASHING ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)


# --- JWT TOKEN GENERATION ---
# In a real production app, NEVER hardcode this. You would load it from a .env file!
SECRET_KEY = "super-secret-bobooks-key-change-me-later" 
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7 # Keep users logged in for a week

def create_access_token(data: dict):
    """Creates a signed JSON Web Token."""
    to_encode = data.copy()
    
    # Set the expiration time
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    
    # Sign the token with our secret key
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt