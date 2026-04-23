
import os

file_path = r'c:\Appzeto-Quick-Commerce\frontend\src\modules\admin\pages\ProductManagement.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
found = False
for line in lines:
    new_lines.append(line)
    if 'const [products, setProducts] = useState([]);' in line and not found:
        new_lines.append('    const [isSearchingMaster, setIsSearchingMaster] = useState(false);\n')
        found = True

if found:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print("Successfully updated the file.")
else:
    print("Target line not found.")
