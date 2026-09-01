from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from apps.tasks.models import Task

User = get_user_model()


class TaskFilterTests(APITestCase):
    url = "/api/v1/tasks/"

    def setUp(self):
        self.user = User.objects.create_user(username="filteruser", password="Sup3rSegura123")
        self.client.force_authenticate(user=self.user)

        self.active_done = Task.objects.create(
            user=self.user, title="Estudiar Django", completed=True, position=0
        )
        self.active_pending = Task.objects.create(
            user=self.user, title="Comprar pan", completed=False, position=1
        )
        self.deleted_task = Task.objects.create(
            user=self.user, title="Tarea vieja", completed=False,
            position=2, is_deleted=True,
        )

    def test_default_list_returns_only_active(self):
        response = self.client.get(self.url)
        ids = {t["id"] for t in response.data["results"]}
        self.assertEqual(ids, {self.active_done.id, self.active_pending.id})

    def test_deleted_false_returns_active(self):
        response = self.client.get(self.url, {"deleted": "false"})
        ids = {t["id"] for t in response.data["results"]}
        self.assertEqual(ids, {self.active_done.id, self.active_pending.id})

    def test_deleted_true_returns_only_deleted(self):
        response = self.client.get(self.url, {"deleted": "true"})
        ids = {t["id"] for t in response.data["results"]}
        self.assertEqual(ids, {self.deleted_task.id})

    def test_completed_filter(self):
        response = self.client.get(self.url, {"completed": "true"})
        ids = {t["id"] for t in response.data["results"]}
        self.assertEqual(ids, {self.active_done.id})

    def test_search_by_title(self):
        response = self.client.get(self.url, {"search": "Django"})
        ids = {t["id"] for t in response.data["results"]}
        self.assertEqual(ids, {self.active_done.id})

    def test_ordering_by_title(self):
        response = self.client.get(self.url, {"ordering": "title"})
        titles = [t["title"] for t in response.data["results"]]
        self.assertEqual(titles, sorted(titles))

    def test_default_ordering_is_position_then_created_at(self):
        response = self.client.get(self.url)
        ids = [t["id"] for t in response.data["results"]]
        self.assertEqual(ids, [self.active_done.id, self.active_pending.id])

    def test_combined_filters_search_and_completed(self):
        response = self.client.get(self.url, {"completed": "false", "search": "pan"})
        ids = {t["id"] for t in response.data["results"]}
        self.assertEqual(ids, {self.active_pending.id})