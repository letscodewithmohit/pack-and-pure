
const fs = require('fs');
const filePath = 'c:/Appzeto-Quick-Commerce/frontend/src/modules/admin/pages/ProductManagement.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const target = 'const [products, setProducts] = useState([]);';
const definition = 'const [isSearchingMaster, setIsSearchingMaster] = useState(false);';

if (content.includes(target) && !content.includes(definition)) {
    content = content.replace(target, target + '\n    ' + definition);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Update Successful');
} else if (content.includes(definition)) {
    console.log('Definition already exists');
} else {
    console.log('Target line not found');
}
