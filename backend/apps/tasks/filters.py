import django_filters

from apps.tasks.models import Task


class TaskFilterSet(django_filters.FilterSet):
    """
    Filtros del listado de tareas.

    `deleted` es un alias público del campo real `is_deleted`. No
    fuerza ningún valor por defecto aquí: cuando el parámetro está
    ausente, el comportamiento por defecto (solo activas) lo resuelve
    get_queryset() de la vista, no este FilterSet.
    """

    deleted = django_filters.BooleanFilter(field_name="is_deleted")

    class Meta:
        model = Task
        fields = ["completed", "deleted"]
        