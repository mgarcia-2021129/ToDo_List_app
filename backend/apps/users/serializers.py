from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    """
    Serializer de registro de usuarios.

    Acepta `username` y `password`. La contraseña se valida con los
    validadores estándar de Django y se almacena mediante
    `set_password`, nunca en texto plano. La representación de salida
    expone únicamente `id` y `username`; `password` nunca se serializa
    de vuelta al cliente.
    """

    password = serializers.CharField(
        write_only=True,
        validators=[validate_password],
    )

    class Meta:
        model = User
        fields = ["id", "username", "password"]
        read_only_fields = ["id"]
        extra_kwargs = {
            "username": {
                "validators": [
                    UniqueValidator(
                        queryset=User.objects.all(),
                        message="Este nombre de usuario ya está en uso.",
                    )
                ]
            },
        }

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user