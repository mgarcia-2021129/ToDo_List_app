from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """
    Modelo de usuario del sistema.

    Extiende AbstractUser para mantener flexibilidad futura sin tener
    que migrar el modelo de autenticación más adelante. No agrega
    campos ni lógica adicional en esta fase: usa username/password
    y todo el comportamiento estándar heredado de AbstractUser.
    """
    pass