from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.tasks.models import Task


def reorder_tasks(user, task_ids):
    """
    Reordena en lote las tareas activas de un usuario.

    El payload debe contener exactamente el conjunto completo de IDs
    de tareas activas del usuario, cada una una única vez. La posición
    final de cada tarea se determina por su índice dentro de la lista
    recibida.

    Cualquier condición de error (duplicados, IDs inexistentes, ajenos
    o de tareas eliminadas, o tareas activas faltantes en el payload)
    rechaza la operación completa sin modificar ninguna tarea.
    """

    if len(task_ids) != len(set(task_ids)):
        raise ValidationError(
            {"task_ids": "La lista contiene IDs duplicados."}
        )

    with transaction.atomic():
        active_tasks = list(
            Task.objects.select_for_update()
            .filter(user=user, is_deleted=False)
        )

        active_ids = {task.id for task in active_tasks}
        received_ids = set(task_ids)

        if received_ids != active_ids:
            raise ValidationError(
                {
                    "task_ids": (
                        "El conjunto de IDs no coincide exactamente con "
                        "las tareas activas del usuario."
                    )
                }
            )

        tasks_by_id = {task.id: task for task in active_tasks}
        for position, task_id in enumerate(task_ids):
            tasks_by_id[task_id].position = position

        Task.objects.bulk_update(active_tasks, ["position"])