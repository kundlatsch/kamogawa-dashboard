import secrets

# No ambiguous characters (0/O, 1/l/I) so passwords are easy to read aloud or copy by hand.
ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_password(length: int = 10) -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(length))
