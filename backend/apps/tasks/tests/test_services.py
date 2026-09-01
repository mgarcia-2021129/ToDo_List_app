import inspect

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.exceptions import ValidationError

from apps.tasks.models import Task
from apps.tasks import services
from apps.tasks.services import reorder_tasks

User = get_user_model()


class ReorderTasksTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="Sup3rSegura123")
        self.other_user = User.objects.create_user(username="other", password="Sup3rSegura123")

        self.t1 = Task.objects.create(user=self.user, title="T1", position=0)
        self.t2 = Task.objects.create(user=self.user, title="T2", position=1)
        self.t3 = Task.objects.create(user=self.user, title="T3", position=2)

    def _positions(self):
        return {
            t.id: t.position
            for t in Task.objects.filter(user=self.user, is_deleted=False)
        }

    def test_successful_reorder_assigns_position_by_index(self):
        reorder_tasks(self.user, [self.t3.id, self.t1.id, self.t2.id])

        positions = self._positions()
        self.assertEqual(positions[self.t3.id], 0)
        self.assertEqual(positions[self.t1.id], 1)
        self.assertEqual(positions[self.t2.id], 2)

    def test_duplicate_ids_are_rejected(self):
        with self.assertRaises(ValidationError):
            reorder_tasks(self.user, [self.t1.id, self.t1.id, self.t2.id, self.t3.id])

    def test_missing_active_task_is_rejected(self):
        with self.assertRaises(ValidationError):
            reorder_tasks(self.user, [self.t1.id, self.t2.id])

    def test_nonexistent_id_is_rejected(self):
        with self.assertRaises(ValidationError):
            reorder_tasks(self.user, [self.t1.id, self.t2.id, self.t3.id, 999999])

    def test_id_from_another_user_is_rejected(self):
        foreign_task = Task.objects.create(user=self.other_user, title="Ajena", position=0)

        with self.assertRaises(ValidationError):
            reorder_tasks(self.user, [self.t1.id, self.t2.id, self.t3.id, foreign_task.id])

    def test_deleted_task_id_is_rejected(self):
        self.t3.is_deleted = True
        self.t3.save(update_fields=["is_deleted"])

        with self.assertRaises(ValidationError):
            reorder_tasks(self.user, [self.t1.id, self.t2.id, self.t3.id])

    def test_no_partial_update_on_failure(self):
        original = self._positions()
        try:
            reorder_tasks(self.user, [self.t1.id, self.t1.id, self.t2.id, self.t3.id])
        except ValidationError:
            pass

        self.assertEqual(self._positions(), original)

    def test_uses_transaction_and_select_for_update(self):
        source = inspect.getsource(services)
        self.assertIn("transaction.atomic", source)
        self.assertIn("select_for_update(", source)
        self.assertIn("bulk_update(", source)