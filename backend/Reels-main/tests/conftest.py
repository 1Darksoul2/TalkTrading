import pytest
import os
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Use isolated SQLite database for testing
TEST_DB_FILE = "./test_reel.db"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_FILE}"
os.environ["JWT_SECRET_KEY"] = "test_super_secret_jwt_key_12345"
os.environ["SERVICE_API_KEY"] = "test_service_secret_key"

from app.db.base import Base
from app.db.session import get_db
from app.main import create_application
from app.core.security import create_access_token

test_engine = create_engine(
    f"sqlite:///{TEST_DB_FILE}",
    connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass


@pytest.fixture()
def db_session():
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db_session):
    app = create_application()
    
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_headers():
    token = create_access_token({"sub": "user_creator_001", "email": "creator@test.com"})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def other_auth_headers():
    token = create_access_token({"sub": "user_viewer_999", "email": "viewer@test.com"})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def service_headers():
    return {"X-Service-API-Key": "test_service_secret_key"}
