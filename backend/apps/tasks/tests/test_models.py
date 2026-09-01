from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.tasks.models import Task

User = get_user_model()


class TaskModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="modeluser", password="Sup3rSegura123")

    def test_str_returns_title(self):
        task = Task.objects.create(user=self.user, title="Comprar pan", position=0)
        self.assertEqual(str(task), "Comprar pan")

    def test_completed_defaults_to_false_at_model_level(self):
        task = Task.objects.create(user=self.user, title="Tarea", position=0)
        self.assertFalse(task.completed)

    def test_is_deleted_defaults_to_false(self):
        task = Task.objects.create(user=self.user, title="Tarea", position=0)
        self.assertFalse(task.is_deleted)
        self.assertIsNone(task.deleted_at)