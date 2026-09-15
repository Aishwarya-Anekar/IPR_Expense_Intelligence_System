import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import app


def main():
    app.app.config.update(TESTING=True)
    app.init_db()
    client = app.app.test_client()

    health = client.get('/')
    if health.status_code != 200 or health.json.get('status') != 'running':
        raise RuntimeError(f'Health check failed: {health.status_code} {health.get_data(as_text=True)}')

    login = client.post('/auth/demo')
    if login.status_code != 200:
        raise RuntimeError(f'Demo login failed: {login.status_code} {login.get_data(as_text=True)}')

    headers = {'Authorization': f"Bearer {login.json['access_token']}"}
    report = client.get('/ml/report', headers=headers)
    if report.status_code != 200:
        raise RuntimeError(f'ML report failed: {report.status_code} {report.get_data(as_text=True)}')
    if not report.json.get('accuracy') or not report.json.get('feature_importance'):
        raise RuntimeError('ML report is missing evaluation data')

    print('Backend validation passed: health, demo login, and ML report')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Backend validation failed: {error}', file=sys.stderr)
        raise
