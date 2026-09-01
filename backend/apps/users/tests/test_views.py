from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class RegisterViewTests(APITestCase):
    url = "/api/v1/auth/register/"

    def test_register_success_returns_only_id_and_username(self):
        response = self.client.post(
            self.url, {"username": "carlos", "password": "Sup3rSegura123"}
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(set(response.data.keys()), {"id", "username"})
        self.assertEqual(response.data["username"], "carlos")

    def test_password_is_never_returned(self):
        response = self.client.post(
            self.url, {"username": "carlos2", "password": "Sup3rSegura123"}
        )

        self.assertNotIn("password", response.data)

    def test_password_is_stored_hashed(self):
        self.client.post(
            self.url, {"username": "carlos3", "password": "Sup3rSegura123"}
        )
        user = User.objects.get(username="carlos3")

        self.assertNotEqual(user.password, "Sup3rSegura123")
        self.assertTrue(user.check_password("Sup3rSegura123"))

    def test_username_is_required(self):
        response = self.client.post(self.url, {"password": "Sup3rSegura123"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.data)

    def test_username_must_be_unique(self):
        self.client.post(
            self.url, {"username": "duplicado", "password": "Sup3rSegura123"}
        )
        response = self.client.post(
            self.url, {"username": "duplicado", "password": "OtraSegura123"}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.data)

    def test_weak_password_is_rejected(self):
        response = self.client.post(
            self.url, {"username": "nuevo", "password": "12345678"}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)


class AuthTokenViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="loginuser", password="Sup3rSegura123"
        )

    def test_login_returns_access_and_refresh(self):
        response = self.client.post(
            "/api/v1/auth/login/",
            {"username": "loginuser", "password": "Sup3rSegura123"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_refresh_returns_new_access_token(self):
        login_response = self.client.post(
            "/api/v1/auth/login/",
            {"username": "loginuser", "password": "Sup3rSegura123"},
        )
        refresh_token = login_response.data["refresh"]

        response = self.client.post("/api/v1/auth/refresh/", {"refresh": refresh_token})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)