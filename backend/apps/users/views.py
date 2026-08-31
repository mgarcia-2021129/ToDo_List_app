from rest_framework import generics, permissions

from apps.users.serializers import RegisterSerializer

from django.contrib.auth import get_user_model

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    """
    Endpoint de registro de usuarios.

    Utiliza RegisterSerializer para validar y crear el usuario.
    No requiere autenticación: cualquier cliente puede registrarse.
    La respuesta refleja exactamente la representación de salida
    definida por RegisterSerializer (id, username).
    """

    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]