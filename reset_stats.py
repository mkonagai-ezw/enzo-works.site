import json

# ai_history.jsonを読み込む
with open('ai_history.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# status == "settled"のレコードを削除し、status == "pending"のレコードのみを残す
original_count = len(data['records'])
data['records'] = [r for r in data['records'] if r.get('status') == 'pending']
pending_count = len(data['records'])

# ファイルに保存
with open('ai_history.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=4, ensure_ascii=False)

print(f'統計をリセットしました。')
print(f'削除されたレコード数: {original_count - pending_count}')
print(f'残ったpendingレコード数: {pending_count}')


