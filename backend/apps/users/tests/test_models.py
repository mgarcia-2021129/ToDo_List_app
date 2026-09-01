from django.contrib.auth import get_user_model
from django.test import TestCase

User = get_user_model()


class UserModelTests(TestCase):
    def test_user_extends_abstract_user_and_hashes_password(self):
        user = User.objects.create_user(username="ana", password="Sup3rSegura123")

        self.assertEqual(user.username, "ana")
        self.assertNotEqual(user.password, "Sup3rSegura123")
        self.assertTrue(user.check_password("Sup3rSegura123"))

    def test_username_is_unique_at_db_level(self):
        User.objects.create_user(username="ana", password="Sup3rSegura123")

        with self.assertRaises(Exception):
            User.objects.create_user(username="ana", password="OtraSegura123")