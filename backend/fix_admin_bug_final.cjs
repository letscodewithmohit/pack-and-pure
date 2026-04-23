
const fs = require('fs');
const path = 'c:\\Appzeto-Quick-Commerce\\frontend\\src\\modules\\admin\\pages\\ProductManagement.jsx';

let content = fs.readFileSync(path, 'utf8');
if (content.includes('const [products, setProducts] = useState([]);') && !content.includes('isSearchingMaster')) {
    content = content.replace(
        'const [products, setProducts] = useState([]);',
        'const [products, setProducts] = useState([]);\n    const [isSearchingMaster, setIsSearchingMaster] = useState(false);'
    );
    fs.writeFileSync(path, content);
    console.log('Successfully updated the file.');
} else {
    console.log('Target not found or already updated.');
}
