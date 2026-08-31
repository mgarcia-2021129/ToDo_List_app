from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from apps.tasks.filters import TaskFilterSet
from apps.tasks.pagination import TaskPagination

from apps.tasks.models import Task
from apps.tasks.serializers import (
    TaskSerializer,
    TaskCreateSerializer,
    TaskUpdateSerializer,
    TaskReorderSerializer,
)
from apps.tasks.services import reorder_tasks


class TaskViewSet(viewsets.ModelViewSet):
    """
    CRUD base de Task, más las acciones restore y reorder.

    Todas las operaciones están aisladas al usuario autenticado
    mediante request.user. No existe PUT. DELETE realiza soft delete
    en lugar de eliminación física. Filtrado, búsqueda y ordenamiento
    solo se aplican en `list`; las acciones de detalle no deben verse
    afectadas por parámetros de query incidentales.
    """

    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = TaskFilterSet
    search_fields = ["title"]
    ordering_fields = ["created_at", "title", "position"]
    ordering = ["position", "created_at"]
    pagination_class = TaskPagination

    def get_queryset(self):
        queryset = Task.objects.filter(user=self.request.user)

        if self.action == "restore":
            return queryset

        if self.action == "list":
            if "deleted" not in self.request.query_params:
                return queryset.filter(is_deleted=False)
            return queryset

        return queryset.filter(is_deleted=False)

    def filter_queryset(self, queryset):
        # Filtrado, búsqueda y ordenamiento solo tienen sentido en el
        # listado. Aplicarlos también en acciones de detalle podría
        # excluir incidentalmente el objeto buscado por get_object().
        if self.action == "list":
            return super().filter_queryset(queryset)
        return queryset

    def get_serializer_class(self):
        if self.action == "create":
            return TaskCreateSerializer
        if self.action == "partial_update":
            return TaskUpdateSerializer
        if self.action == "reorder":
            return TaskReorderSerializer
        return TaskSerializer

    def perform_create(self, serializer):
        last_position = (
            Task.objects.filter(user=self.request.user, is_deleted=False)
            .order_by("-position")
            .values_list("position", flat=True)
            .first()
        )
        next_position = 0 if last_position is None else last_position + 1

        serializer.save(user=self.request.user, position=next_position)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        instance = serializer.instance
        output_serializer = TaskSerializer(instance)
        headers = self.get_success_headers(output_serializer.data)
        return Response(
            output_serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        instance.refresh_from_db()
        output_serializer = TaskSerializer(instance)
        return Response(output_serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["is_deleted", "deleted_at", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        task = self.get_object()

        if not task.is_deleted:
            return Response(status=status.HTTP_409_CONFLICT)

        task.is_deleted = False
        task.deleted_at = None
        task.save(update_fields=["is_deleted", "deleted_at", "updated_at"])

        serializer = TaskSerializer(task)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"])
    def reorder(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reorder_tasks(
            user=request.user,
            task_ids=serializer.validated_data["task_ids"],
        )

        return Response(status=status.HTTP_200_OK)