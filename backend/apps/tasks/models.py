from django.conf import settings
from django.db import models


class Task(models.Model):
    """
    Representa una tarea perteneciente a un usuario.

    El campo `position` habilita el orden manual de tareas (utilizado
    por el reordenamiento en lote). El soft delete se implementa
    mediante `is_deleted` / `deleted_at`: las tareas nunca se eliminan
    físicamente mediante el flujo normal de la aplicación.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tasks",
    )
    title = models.CharField(max_length=255)
    completed = models.BooleanField(default=False)
    position = models.PositiveIntegerField()
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "is_deleted"]),
            models.Index(fields=["user", "position"]),
        ]

    def __str__(self):
        return self.title