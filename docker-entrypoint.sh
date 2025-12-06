#!/bin/sh
set -e

# Helper function to load secret from file
file_env() {
    local var="$1"
    local fileVar="${var}_FILE"
    local def="${2:-}"
    
    # Check if the variable is already set
    if [ "${!var:-}" ] && [ "${!fileVar:-}" ]; then
        echo >&2 "error: both $var and $fileVar are set (but are exclusive)"
        exit 1
    fi
    
    local val="$def"
    
    # Check if the file variable is set
    if [ "${!fileVar:-}" ]; then
        if [ -f "${!fileVar}" ]; then
            val="$(cat "${!fileVar}")"
        else
            echo >&2 "error: file specified by $fileVar ('${!fileVar}') does not exist"
            exit 1
        fi
    fi
    
    # Export the variable if we have a value and it's not already set
    if [ -n "$val" ] && [ -z "${!var:-}" ]; then
        export "$var"="$val"
    fi
    
    unset "$fileVar"
}

# Load secrets for specific variables
file_env 'PROMPT_REPO_URL'
file_env 'PROMPT_REPO_URLS'
file_env 'SYSTEM_REPO_URL'
# Add others if needed

# Execute the command
exec "$@"
