import os
from dotenv import load_dotenv

# Load dummy env for tests
os.environ["GEMINI_API_KEY"] = "testing_key"
load_dotenv(".env.example")
