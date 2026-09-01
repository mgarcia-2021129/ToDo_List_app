from rest_framework import serializers

from apps.tasks.models import Task


class TaskSerializer(serializers.ModelSerializer):
    """
    Representación de una tarea para listado, detalle, y respuestas
    tras crear, actualizar, restaurar o reordenar.

    No expone `user`: el aislamiento por usuario se resuelve en la
    capa de queryset/vista, no es necesario reflejarlo aquí.
    """

    class Meta:
        model = Task
        fields = [
            "id",
            "title",
            "completed",
            "position",
            "is_deleted",
            "deleted_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class TaskCreateSerializer(serializers.ModelSerializer):
    """
    Serializer de creación de tareas.

    Acepta únicamente `title` y `completed`. El usuario propietario y
    la posición inicial se asignan en la capa de vista/servicio, no
    aquí. Los campos técnicos (`user`, `position`, `is_deleted`,
    `deleted_at`, `created_at`, `updated_at`) quedan fuera de este
    serializer por completo: no se aceptan ni se calculan en este
    paso.
    """

    completed = serializers.BooleanField(required=False, default=False)

    class Meta:
        model = Task
        fields = ["title", "completed"]


class TaskUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer de actualización parcial (PATCH).

    Permite únicamente `title` y `completed`, ambos opcionales. No
    permite modificar ningún otro campo del modelo.
    """

    class Meta:
        model = Task
        fields = ["title", "completed"]
        extra_kwargs = {
            "title": {"required": False},
            "completed": {"required": False},
        }


class TaskReorderSerializer(serializers.Serializer):
    """
    Valida la estructura del payload de reordenamiento en lote:

        {"task_ids": [1, 3, 2, 4]}

    Solo valida forma (presencia, tipo lista, no vacía, elementos
    enteros). La validación de pertenencia al usuario y de
    coincidencia exacta con el conjunto de tareas activas es
    responsabilidad de tasks/services.py, no de este serializer.
    """

    task_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False,
    )