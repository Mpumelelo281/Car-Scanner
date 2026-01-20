#!/usr/bin/env python
import sys
import logging
import signal
import os

# Set up logging to file
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('server.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

# Handle Windows signals gracefully
def signal_handler(sig, frame):
    logger.info('Received signal, shutting down gracefully...')
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

try:
    # Prevent sys.exit() from being called by Flask
    os.environ['WERKZEUG_RUN_MAIN'] = 'true'
    
    from waitress import serve
    from app import app
    
    logger.info("Starting Car Scanner API Server...")
    logger.info("Server running on http://0.0.0.0:5000")
    logger.info("Press Ctrl+C to stop")
    
    serve(app, host='0.0.0.0', port=5000, threads=10)
except Exception as e:
    logger.error(f"Fatal error: {e}", exc_info=True)
    sys.exit(1)
