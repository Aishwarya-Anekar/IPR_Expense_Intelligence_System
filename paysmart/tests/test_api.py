import os
import tempfile
import unittest


TEST_DB = tempfile.NamedTemporaryFile(suffix='.db', delete=False).name
os.environ['PAYSMART_DB_PATH'] = TEST_DB
os.environ['PAYSMART_JWT_SECRET'] = 'test-secret'

import app as paysmart


class PaySmartApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        paysmart.app.config.update(TESTING=True)
        paysmart.init_db()
        cls.client = paysmart.app.test_client()

    @classmethod
    def tearDownClass(cls):
        paysmart.app.config.update(TESTING=False)
        for suffix in ('', '-wal', '-shm'):
            try:
                os.remove(TEST_DB + suffix)
            except FileNotFoundError:
                pass

    def login(self):
        response = self.client.post('/auth/demo')
        self.assertEqual(response.status_code, 200)
        return {'Authorization': f"Bearer {response.json['access_token']}"}

    def test_health_endpoint(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['status'], 'running')

    def test_ml_report_returns_evaluated_model_data(self):
        response = self.client.get('/ml/report', headers=self.login())
        self.assertEqual(response.status_code, 200)
        self.assertGreater(response.json['accuracy'], 0)
        self.assertEqual(response.json['feature_count'], 7)
        self.assertGreaterEqual(len(response.json['classification_report']), 1)
        self.assertGreaterEqual(len(response.json['feature_importance']), 1)

    def test_incomplete_setup_cannot_create_payment(self):
        headers = self.login()
        response = self.client.post('/transactions', headers=headers, json={
            'merchant': 'Test', 'amount': 10, 'category': 'Other', 'confidence': 50
        })
        self.assertEqual(response.status_code, 403)
        self.assertIn('Complete UPI setup', response.json['error'])

    def test_setup_allows_payment_after_completion(self):
        headers = self.login()
        setup = self.client.post('/auth/pin', headers=headers, json={
            'pin': '1234',
            'bank_name': 'SBI',
            'account_number': '1234567890',
            'ifsc_code': 'SBIN0001234',
            'upi': 'arjun@paysmart',
        })
        self.assertEqual(setup.status_code, 200)
        self.assertTrue(setup.json['user']['upi_setup_completed'])

        payment = self.client.post('/transactions', headers=headers, json={
            'merchant': 'Test', 'amount': 10, 'category': 'Other', 'confidence': 50
        })
        self.assertEqual(payment.status_code, 200)
        self.assertTrue(payment.json['success'])

    def test_registration_requires_upi_id(self):
        response = self.client.post('/auth/register', json={
            'firstname': 'Test', 'lastname': 'User', 'email': 'test@example.com',
            'phone': '9999999999', 'password': 'secret1', 'confirm': 'secret1'
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('UPI', response.json['error'])


if __name__ == '__main__':
    unittest.main()
