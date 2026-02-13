#!/bin/bash
# Felix Backup Decryption Script
# Usage: ./decrypt.sh <backup-file> [output-dir]

BACKUP_FILE="${1:-}"
OUTPUT_DIR="${2:-./restored}"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file> [output-dir]"
    exit 1
fi

KEY_FILE="memory/.backup-key"

if [ ! -f "$KEY_FILE" ]; then
    echo "Error: Encryption key not found at $KEY_FILE"
    exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "Decrypting $BACKUP_FILE..."

# Extract IV (first 16 bytes)
IV=$(head -c 16 "$BACKUP_FILE" | xxd -p)

# Extract encrypted data (minus IV and auth tag)
TEMP_FILE=$(mktemp)
tail -c +17 "$BACKUP_FILE" | head -c -16 > "$TEMP_FILE"

# Extract auth tag (last 16 bytes)
AUTH_TAG=$(tail -c 16 "$BACKUP_FILE" | xxd -p)

# Decrypt and extract
openssl enc -aes-256-gcm -d -K $(xxd -p -c 32 "$KEY_FILE") -iv "$IV" -in "$TEMP_FILE" | tar -xzf - -C "$OUTPUT_DIR"

rm "$TEMP_FILE"

echo "Decryption complete. Files restored to $OUTPUT_DIR"
