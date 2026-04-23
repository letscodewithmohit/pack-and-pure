
const fs = require('fs');
const filePath = 'c:/Appzeto-Quick-Commerce/frontend/src/modules/admin/pages/ProductManagement.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Find the line with products state and insert the missing state after it
const target = 'const [products, setProducts] = useState([]);';
const insert = '\n    const [isSearchingMaster, setIsSearchingMaster] = useState(false);';

if (content.includes(target) && !content.includes('isSearchingMaster')) {
    content = content.replace(target, target + insert);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Update Successful');
} else if (content.includes('isSearchingMaster')) {
    console.log('Already updated');
} else {
    console.log('Target line not found');
}
