import logging
import logging.config
import sys

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "%(asctime)s | %(levelname)s | [%(name)s] %(message)s",
            "datefmt": "%H:%M:%S",
        },
    },
    "handlers": {
        "default": {
            "level": "INFO",
            "formatter": "standard",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout",
        },
    },
    "loggers": {
        "": {  # root logger
            "handlers": ["default"],
            "level": "INFO",
            "propagate": True,
        },
        "httpx": {
            "handlers": ["default"],
            "level": "WARNING",
            "propagate": False,
        },
        "httpcore": {
            "handlers": ["default"],
            "level": "WARNING",
            "propagate": False,
        },
        "google_genai.models": {
            "handlers": ["default"],
            "level": "WARNING",
            "propagate": False,
        },
    },
}

def setup_logger():
    logging.config.dictConfig(LOGGING_CONFIG)
    return logging.getLogger()

# Initialize logging
logger = setup_logger()
