from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.tasks.models import Task

User = get_user_model()


class TaskAuthenticationTests(APITestCase):
    url = "/api/v1/tasks/"

    def test_list_requires_authentication(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_user_can_list(self):
        user = User.objects.create_user(username="authuser", password="Sup3rSegura123")
        self.client.force_authenticate(user=user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class TaskCreateTests(APITestCase):
    url = "/api/v1/tasks/"

    def setUp(self):
        self.user = User.objects.create_user(username="creator", password="Sup3rSegura123")
        self.client.force_authenticate(user=self.user)

    def test_create_task_minimal_payload(self):
        response = self.client.post(self.url, {"title": "Tarea de prueba"})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Tarea de prueba")
        self.assertFalse(response.data["completed"])
        self.assertEqual(response.data["position"], 0)

    def test_created_task_belongs_to_request_user(self):
        response = self.client.post(self.url, {"title": "Tarea"})
        task = Task.objects.get(id=response.data["id"])
        self.assertEqual(task.user, self.user)

    def test_client_cannot_override_position(self):
        response = self.client.post(self.url, {"title": "Tarea", "position": 999})
        self.assertEqual(response.data["position"], 0)

    def test_client_cannot_set_readonly_fields(self):
        response = self.client.post(
            self.url,
            {
                "title": "Tarea",
                "is_deleted": True,
                "deleted_at": "2020-01-01T00:00:00Z",
                "user": 999,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        task = Task.objects.get(id=response.data["id"])
        self.assertFalse(task.is_deleted)
        self.assertIsNone(task.deleted_at)
        self.assertEqual(task.user, self.user)

    def test_positions_increment_with_max_plus_one(self):
        first = self.client.post(self.url, {"title": "Uno"}).data
        second = self.client.post(self.url, {"title": "Dos"}).data
        self.assertEqual(first["position"], 0)
        self.assertEqual(second["position"], 1)


class TaskIsolationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="u1", password="Sup3rSegura123")
        self.other = User.objects.create_user(username="u2", password="Sup3rSegura123")
        self.client.force_authenticate(user=self.user)

        self.own_task = Task.objects.create(user=self.user, title="Mia", position=0)
        self.foreign_task = Task.objects.create(user=self.other, title="Ajena", position=0)

    def test_list_only_shows_own_tasks(self):
        response = self.client.get("/api/v1/tasks/")
        ids = {t["id"] for t in response.data["results"]}
        self.assertEqual(ids, {self.own_task.id})

    def test_cannot_retrieve_foreign_task(self):
        response = self.client.get(f"/api/v1/tasks/{self.foreign_task.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_patch_foreign_task(self):
        response = self.client.patch(
            f"/api/v1/tasks/{self.foreign_task.id}/", {"title": "Hackeada"}
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_delete_foreign_task(self):
        response = self.client.delete(f"/api/v1/tasks/{self.foreign_task.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_restore_foreign_task(self):
        self.foreign_task.is_deleted = True
        self.foreign_task.save(update_fields=["is_deleted"])
        response = self.client.post(f"/api/v1/tasks/{self.foreign_task.id}/restore/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_include_foreign_task_in_reorder(self):
        response = self.client.post(
            "/api/v1/tasks/reorder/",
            {"task_ids": [self.own_task.id, self.foreign_task.id]},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class TaskDetailTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="detailuser", password="Sup3rSegura123")
        self.client.force_authenticate(user=self.user)
        self.task = Task.objects.create(user=self.user, title="Detalle", position=0)

    def test_retrieve_active_task(self):
        response = self.client.get(f"/api/v1/tasks/{self.task.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_retrieve_deleted_task_returns_404(self):
        self.task.is_deleted = True
        self.task.save(update_fields=["is_deleted"])
        response = self.client.get(f"/api/v1/tasks/{self.task.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class TaskPatchTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="patchuser", password="Sup3rSegura123")
        self.client.force_authenticate(user=self.user)
        self.task = Task.objects.create(user=self.user, title="Original", position=0)

    def test_patch_updates_title_and_completed(self):
        response = self.client.patch(
            f"/api/v1/tasks/{self.task.id}/",
            {"title": "Actualizada", "completed": True},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "Actualizada")
        self.assertTrue(response.data["completed"])

    def test_patch_deleted_task_returns_404(self):
        self.task.is_deleted = True
        self.task.save(update_fields=["is_deleted"])
        response = self.client.patch(
            f"/api/v1/tasks/{self.task.id}/", {"title": "No debería"}
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_patch_ignores_protected_fields(self):
        other = User.objects.create_user(username="otro", password="Sup3rSegura123")

        self.client.patch(
            f"/api/v1/tasks/{self.task.id}/",
            {
                "user": other.id,
                "position": 999,
                "is_deleted": True,
                "deleted_at": "2020-01-01T00:00:00Z",
            },
        )

        self.task.refresh_from_db()
        self.assertEqual(self.task.user, self.user)
        self.assertEqual(self.task.position, 0)
        self.assertFalse(self.task.is_deleted)
        self.assertIsNone(self.task.deleted_at)


class TaskDeleteTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="deleteuser", password="Sup3rSegura123")
        self.client.force_authenticate(user=self.user)
        self.task = Task.objects.create(user=self.user, title="Borrar", position=0)

    def test_delete_is_soft(self):
        response = self.client.delete(f"/api/v1/tasks/{self.task.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.task.refresh_from_db()
        self.assertTrue(self.task.is_deleted)
        self.assertIsNotNone(self.task.deleted_at)
        self.assertTrue(Task.objects.filter(id=self.task.id).exists())

    def test_deleted_task_hidden_from_default_list_but_visible_with_filter(self):
        self.client.delete(f"/api/v1/tasks/{self.task.id}/")

        default_list = self.client.get("/api/v1/tasks/")
        deleted_list = self.client.get("/api/v1/tasks/", {"deleted": "true"})

        self.assertNotIn(self.task.id, [t["id"] for t in default_list.data["results"]])
        self.assertIn(self.task.id, [t["id"] for t in deleted_list.data["results"]])

    def test_double_delete_returns_404(self):
        self.client.delete(f"/api/v1/tasks/{self.task.id}/")
        response = self.client.delete(f"/api/v1/tasks/{self.task.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class TaskRestoreTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="restoreuser", password="Sup3rSegura123")
        self.client.force_authenticate(user=self.user)
        self.task = Task.objects.create(user=self.user, title="Restaurar", position=3)

    def test_restore_deleted_task(self):
        self.task.is_deleted = True
        self.task.deleted_at = "2024-01-01T00:00:00Z"
        self.task.save(update_fields=["is_deleted", "deleted_at"])

        response = self.client.post(f"/api/v1/tasks/{self.task.id}/restore/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.task.refresh_from_db()
        self.assertFalse(self.task.is_deleted)
        self.assertIsNone(self.task.deleted_at)
        self.assertEqual(self.task.position, 3)

    def test_restore_active_task_returns_409(self):
        response = self.client.post(f"/api/v1/tasks/{self.task.id}/restore/")
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_restore_nonexistent_task_returns_404(self):
        response = self.client.post("/api/v1/tasks/999999/restore/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class TaskReorderTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="reorderuser", password="Sup3rSegura123")
        self.client.force_authenticate(user=self.user)

        self.t1 = Task.objects.create(user=self.user, title="T1", position=0)
        self.t2 = Task.objects.create(user=self.user, title="T2", position=1)
        self.t3 = Task.objects.create(user=self.user, title="T3", position=2)

    def test_successful_reorder(self):
        response = self.client.post(
            "/api/v1/tasks/reorder/",
            {"task_ids": [self.t3.id, self.t1.id, self.t2.id]},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.t1.refresh_from_db()
        self.t2.refresh_from_db()
        self.t3.refresh_from_db()
        self.assertEqual(self.t3.position, 0)
        self.assertEqual(self.t1.position, 1)
        self.assertEqual(self.t2.position, 2)

    def test_empty_payload_rejected(self):
        response = self.client.post("/api/v1/tasks/reorder/", {"task_ids": []})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_task_ids_must_be_a_list(self):
        response = self.client.post("/api/v1/tasks/reorder/", {"task_ids": "no-es-lista"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_integer_ids_rejected(self):
        response = self.client.post(
            "/api/v1/tasks/reorder/", {"task_ids": [self.t1.id, "abc", self.t3.id]}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_ids_rejected(self):
        response = self.client.post(
            "/api/v1/tasks/reorder/",
            {"task_ids": [self.t1.id, self.t1.id, self.t2.id, self.t3.id]},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_active_task_rejected(self):
        response = self.client.post(
            "/api/v1/tasks/reorder/", {"task_ids": [self.t1.id, self.t2.id]}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_deleted_task_id_rejected(self):
        self.t3.is_deleted = True
        self.t3.save(update_fields=["is_deleted"])
        response = self.client.post(
            "/api/v1/tasks/reorder/",
            {"task_ids": [self.t1.id, self.t2.id, self.t3.id]},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_no_partial_modification_on_failed_reorder(self):
        self.client.post(
            "/api/v1/tasks/reorder/",
            {"task_ids": [self.t1.id, self.t1.id, self.t2.id, self.t3.id]},
        )
        self.t1.refresh_from_db()
        self.t2.refresh_from_db()
        self.t3.refresh_from_db()
        self.assertEqual(self.t1.position, 0)
        self.assertEqual(self.t2.position, 1)
        self.assertEqual(self.t3.position, 2)


class TaskPutTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="putuser", password="Sup3rSegura123")
        self.client.force_authenticate(user=self.user)
        self.task = Task.objects.create(user=self.user, title="Put", position=0)

    def test_put_returns_405(self):
        response = self.client.put(f"/api/v1/tasks/{self.task.id}/", {"title": "Nuevo"})
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)


class TaskPaginationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="pageuser", password="Sup3rSegura123")
        self.client.force_authenticate(user=self.user)
        for i in range(15):
            Task.objects.create(user=self.user, title=f"Tarea {i}", position=i)

    def test_default_page_size_is_ten(self):
        response = self.client.get("/api/v1/tasks/")
        self.assertEqual(len(response.data["results"]), 10)
        self.assertEqual(response.data["count"], 15)

    def test_custom_page_size(self):
        response = self.client.get("/api/v1/tasks/", {"page_size": 5})
        self.assertEqual(len(response.data["results"]), 5)

    def test_page_size_respects_max(self):
        response = self.client.get("/api/v1/tasks/", {"page_size": 500})
        self.assertEqual(len(response.data["results"]), 15)

    def test_nonexistent_page_returns_404(self):
        response = self.client.get("/api/v1/tasks/", {"page": 999})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)