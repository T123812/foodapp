// Inicializace čtečky ZXing
const codeReader = new ZXing.BrowserMultiFormatReader();

document.addEventListener("DOMContentLoaded", () => {
    const barcodeUploadBtn = document.getElementById('barcode-upload-btn');
    const barcodePhotoInput = document.getElementById('barcode-photo-input');
    const loadingStatus = document.getElementById('loading-status');
    
    const inputName = document.getElementById('name');
    const inputCategory = document.getElementById('category');
    const inputPrice = document.getElementById('price');
    const inputQuantity = document.getElementById('qty');
    const inputExpiry = document.getElementById('expiry');

    // Automatické předvyplnění dnešního data do záruky při načtení
    if (inputExpiry && !inputExpiry.value) {
        inputExpiry.value = new Date().toISOString().split('T')[0];
    }

    // Hlídání automatického množství (Nápoje = 6, ostatní = 1)
    function updateQuantityBasedOnCategory(category) {
        if (category === 'Nápoje') {
            inputQuantity.value = 6;
        } else {
            inputQuantity.value = 1;
        }
    }

    // Pokud uživatel změní kategorii ručně, přepočítáme množství
    inputCategory.addEventListener('change', (e) => {
        updateQuantityBasedOnCategory(e.target.value);
    });

    // Propojení kliknutí na designové tlačítko se skrytým inputem
    barcodeUploadBtn.addEventListener('click', () => barcodePhotoInput.click());

    // Zpracování vybraného obrázku z galerie
    barcodePhotoInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            loadingStatus.style.display = 'block';
            barcodeUploadBtn.disabled = true;

            const imageUrl = URL.createObjectURL(file);
            let barcodeNumber = null;

            // Pokus 1: Normální směr fotky
            try {
                const result = await codeReader.decodeFromImageUrl(imageUrl);
                barcodeNumber = result.text;
            } catch (e) {
                console.log("Pokus 1 selhal, zkouším fotku otočit o 90°...");
            }

            // Pokus 2: Otočení fotky na výšku (pro vertikální kódy)
            if (!barcodeNumber) {
                const rotatedImageUrl = await rotateImage(imageUrl);
                const result = await codeReader.decodeFromImageUrl(rotatedImageUrl);
                barcodeNumber = result.text;
                URL.revokeObjectURL(rotatedImageUrl);
            }

            console.log('Nalezený EAN kód:', barcodeNumber);
            
            // Zavoláme Open Food Facts
            await fetchProductFromOpenFoodFacts(barcodeNumber);

        } catch (error) {
            console.error(error);
            alert('Čárový kód se nepodařilo přečíst. Zkus kód vyfotit více narovnaný, zblízka a bez odlesků.');
        } finally {
            loadingStatus.style.display = 'none';
            barcodeUploadBtn.disabled = false;
            barcodePhotoInput.value = ''; // Vyčištění inputu
        }
    });

    // Volání Open Food Facts API
    async function fetchProductFromOpenFoodFacts(barcode) {
        const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 1) {
            const product = data.product;
                
            const productName = product.product_name_cs || product.product_name || 'Neznámý produkt';
            const offCategories = product.categories_tags || [];
            const guessedCategory = mapCategory(offCategories);

            // 1. Vyplnění hodnot do buněk
            inputName.value = productName;
            inputCategory.value = guessedCategory;
            inputPrice.value = ''; 

            // 2. Nastavení kusů podle kategorie
            updateQuantityBasedOnCategory(guessedCategory);

            // === ZDE PŘIDÁNO: Nastavení zeleného pozadí a rámečku ===
            inputName.classList.add('auto-filled');
            inputCategory.classList.add('auto-filled');

            // Kurzor skočí na cenu
            inputPrice.focus();
        } else {
            alert(`Kód (${barcode}) byl přečten, ale produkt v databázi Open Food Facts chybí. Zadej informace ručně.`);
            inputName.value = '';
            inputCategory.value = '';
            inputPrice.value = '';
            inputQuantity.value = 1;
            inputPrice.focus();
        }
    }

    // Pomocná funkce pro vnitřní otočení obrázku o 90 stupňů
    function rotateImage(src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.height;
                canvas.height = img.width;
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate(90 * Math.PI / 180);
                ctx.drawImage(img, -img.width / 2, -img.height / 2);
                resolve(canvas.toDataURL());
            };
            img.src = src;
        });
    }

    // Inteligentní mapování kategorií (Sladkosti kontrolovány přednostně)
    function mapCategory(tags) {
        const tagsString = tags.join(' ').toLowerCase();

        if (tagsString.includes('snack') || tagsString.includes('sweet') || tagsString.includes('chocolat') || tagsString.includes('sladk') || tagsString.includes('sušenky')) {
            return 'Sladkosti';
        }
        if (tagsString.includes('dairy') || tagsString.includes('cheese') || tagsString.includes('milk') || tagsString.includes('mlék') || tagsString.includes('jogurt')) {
            return 'Mléčné výrobky';
        }
        if (tagsString.includes('bakery') || tagsString.includes('bread') || tagsString.includes('pečiv') || tagsString.includes('chléb')) {
            return 'Pečivo';
        }
        if (tagsString.includes('salám') || tagsString.includes('sausage') || tagsString.includes('šunk') || tagsString.includes('párky')) {
            return 'Salámy';
        }
        if (tagsString.includes('meat') || tagsString.includes('mas') || tagsString.includes('poultry') || tagsString.includes('hovězí') || tagsString.includes('kuřecí')) {
            return 'Maso';
        }
        if (tagsString.includes('beverages') || tagsString.includes('drinks') || tagsString.includes('nápoj') || tagsString.includes('cola') || tagsString.includes('voda')) {
            return 'Nápoje';
        }
        if (tagsString.includes('ice cream') || tagsString.includes('nanuk') || tagsString.includes('zmrzlin')) {
            return 'Nanuky';
        }
        if (tagsString.includes('fruits') || tagsString.includes('vegetables') || tagsString.includes('zelen') || tagsString.includes('ovoce')) {
            return 'Ovoce / zelenina';
        }
        if (tagsString.includes('legumes') || tagsString.includes('luštěn') || tagsString.includes('fazole') || tagsString.includes('čočka')) {
            return 'Luštěniny';
        }
        if (tagsString.includes('sauces') || tagsString.includes('kečup') || tagsString.includes('hořčic') || tagsString.includes('dochuc')) {
            return 'Dochucovadla';
        }

        return 'Trvanlivé potraviny';
    }
});