import sys


print('Logging the number "1" to stderr', file=sys.stderr)
print('Logging the number "2" to stderr', file=sys.stderr)
print('Logging the number "87" to stdout')
# Print an empty string to stderr
print('', file=sys.stderr)
print('Logging the string "orangutan" to stderr', file=sys.stderr)
sys.exit(42)
