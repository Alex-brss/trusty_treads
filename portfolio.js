// Invoking strict mode https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode#invoking_strict_mode
'use strict';

// instantiate the selectors
const selectShow = document.querySelector('#show-select');
const selectPage = document.querySelector('#page-select');
const sectionProducts = document.querySelector('#products');
const spanNbProducts = document.querySelector('#nbProducts');
const brandSelect = document.querySelector('#brand-select');
const sortSelect = document.querySelector('#sort-select');
const showOnlySelectSale = document.querySelector('#showOnly-select-sale');
const showOnlySelectNew = document.querySelector('#showOnly-select-new');
const showOnlySelectFavorite = document.querySelector('#showOnly-select-favorite');
const productDiv = document.querySelectorAll(".product");
const page = document.querySelector("#page");
const prevPage = document.querySelector("#prev-page");
const nextPage = document.querySelector("#next-page");
const searchInput = document.querySelector("#search-input");

// current products on the page
let currentProducts = [];
let currentPagination = {};
let brandsCount = 0;
let recentProducts = 0;
let lastRelease = NaN;
let p50 = 0;
let p90 = 0;
let p95 = 0;
let brands = [];
let firstRenderBrands = true;
let favoritesChecked = false;
let searchJustChanged = false;

/**
 * Set global value
 * @param {Array} result - products to display
 * @param {Object} meta - pagination meta info
 */
const setCurrentProducts = ({result, meta}) => {
  currentProducts = result;
  currentPagination = meta;
};

function moteurRecherche(elmts, searchStr) {
  let results = {};

  // Convertir la chaîne de recherche en minuscules une seule fois
  const searchKeywords = searchStr.toLowerCase().split(" ");

  elmts.forEach(elmt => {
    if(elmt.real_name === null) return;
    const nameTokens = elmt.real_name.toLowerCase().split(" ");

    nameTokens.forEach(token => {
        searchKeywords.forEach(keyword => {
            if (keyword === token) {
                results[elmt.id] = (results[elmt.id] || 0) + (keyword.length * 3);
            } else if (token.includes(keyword)) {
                results[elmt.id] = (results[elmt.id] || 0) + (keyword.length * 2);
            } else if (keyword.includes(token)) {
                results[elmt.id] = (results[elmt.id] || 0) + keyword.length;
            }
        });
    });
  });

  return elmts.filter(elmt => elmt.id in results).sort((a, b) => (results[b.id]) - (results[a.id]));
}

/**
 * Fetch products from api
 * @param  {Number}  [page=1] - current page to fetch
 * @param  {Number}  [size=12] - size of the page
 * @return {Object}
 */
const fetchProducts = async (page = 1, size = 12, brand = "All", sortBy = "price-asc", filter = [false, false, false]) => {
  try {
    var data = (JSON.parse(localStorage.getItem("clearfashion-data")) || [])
    console.log(data);
    var result = [];
    if(data.length == 0 || new Date(data.fetchDate).toISOString().split("T")[0] != new Date(Date.now()).toISOString().split("T")[0]) {
      //update products every day
      /*
      const response = await fetch(
        `https://clear-fashion-pied.vercel.app/`
      );*/
      const response = await fetch(
        `products.json`
      );
      const body = await response.json();
      /*
      if (body.success !== true) {
        console.error(body);
        return {currentProducts, currentPagination};
      }
      result = body.data.result;*/
      result = body;
      /*
      brands = await getBrands();
      */
     console.log(result);
      brands = result.map(product => product.brand).filter((v,i,a)=>a.findIndex(t=>(t === v))===i);
      console.log(brands);
      localStorage.setItem("clearfashion-data", JSON.stringify({result: result, fetchDate: new Date(Date.now()), brands: brands}));
    } else {
      result = data.result;
      brands = data.brands;
    }
    if(firstRenderBrands) {
      renderBrands(brands);
      firstRenderBrands = false;
    }
    result = brand !== "All" ? result.filter(product => product.brand === brand) : result;
    var fav = (JSON.parse(localStorage.getItem("favorites")) || []);

    // filters
    if(filter[0]) {
      result = result.filter(product => product.vinted_price !== null);
    }
    if(filter[1]) {
      result = result.filter(product => (new Date() - new Date(product.scrapDate)) / (1000 * 60 * 60 * 24) < 14);
    }
    if(filter[2]){
      result = result.filter(product => fav.includes(product.id));
    }

    var meta = {
      currentPage: page,
      pageCount: Math.ceil(result.length / size),
      pageSize: size,
      count: result.length
    };
    
    if(sortBy === "price-asc") {
      result.sort((a, b) => a.price - b.price);
    }
    else if(sortBy === "price-desc") {
      result.sort((a, b) => b.price - a.price);
    }
    else if(sortBy === "date-asc") {
      result.sort((a, b) => new Date(b.scrapDate) - new Date(a.scrapDate));
    }
    else if(sortBy === "date-desc") {
      result.sort((a, b) => new Date(a.scrapDate) - new Date(b.scrapDate));
    }

    brandsCount = 0
    if(result.length > 0){
      result.reduce((acc, product) => {
        if(!acc[product.brand]) {
          acc[product.brand] = 1;
          brandsCount++;
        }
        return acc;
      }, {});
    };

    recentProducts = result.filter(product => (new Date() - new Date(product.scrapDate)) / (1000 * 60 * 60 * 24) < 14).length;

    lastRelease = result.length > 0 ? result.reduce(function(a,b) {
      return new Date(a.scrapDate) > new Date(b.scrapDate) ? a : b;
    }).scrapDate : "Nan";

    if(searchInput.value.trim() !== "") {
      result = moteurRecherche(result, searchInput.value.trim());
      if (searchJustChanged) {
        page = 1;
        searchJustChanged = false;
      }
      meta = {
        currentPage: page,
        pageCount: Math.ceil(result.length / size),
        pageSize: size,
        count: result.length
      };
    }

    result = result.slice((page - 1) * size, page * size);

    console.log(result);

    return {result, meta};
    
  } catch (error) {
    console.error(error);
    return {currentProducts, currentPagination};
  }
};

/**
 * Render list of products
 * @param  {Array} products
 */
const renderProducts = products => {
  const fragment = document.createDocumentFragment();
  const div = document.createElement('div');
  let i = -1;
  const template = products
    .map(product => {
      i++;
      var onestar, twostar, threestar, fourstar, fivestar;
      if (product.vinted_stars !== null) {
        onestar = product.vinted_stars >= 0.5 ? "checked" : "";
        twostar = product.vinted_stars >= 1.5 ? "checked" : "";
        threestar = product.vinted_stars >= 2.5 ? "checked" : "";
        fourstar = product.vinted_stars >= 3.5 ? "checked" : "";
        fivestar = product.vinted_stars >= 4.5 ? "checked" : "";
      }
      const stars = product.vinted_stars !== null ? `<span class="stars">
        <span class="fa fa-star ${onestar}"></span>
        <span class="fa fa-star ${twostar}"></span>
        <span class="fa fa-star ${threestar}"></span>
        <span class="fa fa-star ${fourstar}"></span>
        <span class="fa fa-star ${fivestar}"></span>
      </span>` : "<span class='stars' style='font-style: italic;'><pre>No review</pre></span>";
      const vintedPriceInfo = product.vinted_price !== null ? `<a href="${product.vinted_url}" target="_blank">
      <span style="color: green; font-weight:bold; margin-bottom : -10px;">Vinted : ${product.vinted_price} € </span> </a>
      ${stars}
     ` : `<span style="color: red; cursor: default;font-weight:bold">Unavailable on Vinted</span><span class="stars"><pre> </pre></span>`;

     const rightArrow = product.vinted_img !== null ? `<span class="right-arrow" data-img="${product.vinted_img}">〉</span>` : "";
     const leftArrow = product.vinted_img !== null ? `<span class="left-arrow" data-img="${product.img}" style="display:none">〈</span>` : "";

      return `
      <div class="product" id=${product.id}>
        <div class="product-img">
        ${leftArrow}
        <img src="${product.img !== null ? product.img : "noimg.png"}" alt="${product.name}" />
        ${rightArrow}
        </div>
        <div class="product-info">
        <span style="font-weight: bold;">${product.brand}</span>
        <span>${product.name}</span>
        <a href="${product.url}" target="_blank">
        <span style="font-weight:bold">SNS : ${product.price != null ? product.price + " €" : ""}</span></a>
        ${vintedPriceInfo}
        <span id="${product.id}-fav">`
      + ((JSON.parse(localStorage.getItem("favorites")) || []).includes(product.id) ? `<button onclick="deleteToFavorite(currentProducts[${i}].id)">💔 Delete from favorite</button>` : `<button onclick="addToFavorite(currentProducts[${i}].id)">❤️ Add to favorite</button>`) + `
      </span>
      </div></div>
    `;
    })
    .join('');

  div.innerHTML = template !== "" ? template : "<h2>No products found</h2>";
  fragment.appendChild(div);
  sectionProducts.innerHTML = '';
  sectionProducts.appendChild(fragment);
};

/**
 * Render page selector
 * @param  {Object} pagination
 */
const renderPagination = pagination => {
  const {currentPage, pageCount} = pagination;

  if (pageCount === 0) {
    page.innerHTML = "0 / 0";
    prevPage.className = "is-disabled";
    nextPage.className = "is-disabled";
    return;
  }
  page.innerHTML = currentPage + " / " + pageCount;
  prevPage.className = currentPage == 1 ? "is-disabled" : "is-active";
  nextPage.className = currentPage == pageCount ? "is-disabled" : "is-active";
};


const renderBrands = brands => {
  brands.sort();
  brands = brands.filter(brand => brand !== "All" && brand !== null);
  brands.unshift("All");
  const options = brands.map(brand => `<option value="${brand}">${brand}</option>`).join('');

  brandSelect.innerHTML = options;
};

const render = (products, pagination) => {
  renderProducts(products);
  renderPagination(pagination);

  // Enable right-arrow listener
  document.querySelectorAll(".right-arrow").forEach(element => {
    element.addEventListener('click', () => {
      // Accéder à l'élément parent .product, puis trouver l'image à l'intérieur et changer sa source
      element.closest('.product').querySelector('img').src = element.getAttribute('data-img');

      // Changer la visibilité des flèches
      element.style.display = "none";
      element.closest('.product').querySelector('.left-arrow').style = "";
      element.closest('.product').querySelector('img').style = "margin-left: -30px;"
    });
  });

  // Enable left-arrow listener
  document.querySelectorAll(".left-arrow").forEach(element => {
    element.addEventListener('click', () => {
      // Accéder à l'élément parent .product, puis trouver l'image à l'intérieur et changer sa source
      element.closest('.product').querySelector('img').src = element.getAttribute('data-img');

      // Changer la visibilité des flèches
      element.style.display = "none";
      element.closest('.product').querySelector('.right-arrow').style = "";
      element.closest('.product').querySelector('img').style = ""
    });
  });
};

function addToFavorite(product) {
  var favorites = JSON.parse(localStorage.getItem("favorites")) || [];
  favorites.push(product);
  localStorage.setItem("favorites", JSON.stringify(favorites));
  document.getElementById(product + "-fav").innerHTML = `<button onclick="deleteToFavorite('` + product + `')">💔 Delete from favorite</button>`;
}

async function deleteToFavorite(product) {
  var favorites = JSON.parse(localStorage.getItem("favorites")) || [];
  favorites = favorites.filter(favorite => favorite != product);
  localStorage.setItem("favorites", JSON.stringify(favorites));
  document.getElementById(product + "-fav").innerHTML = `<button onclick="addToFavorite('` + product + `')">❤️ Add to favorite</button>`;
  if(favoritesChecked){
    const products = await fetchProducts(1, currentPagination.pageSize, brandSelect.value, sortSelect.value, [showOnlySelectSale.checked, false, favoritesChecked]);
    setCurrentProducts(products);
    render(currentProducts, currentPagination);
  }
}

async function changeFavorites() {
  showOnlySelectFavorite.innerHTML = favoritesChecked ? "Show favorites" : "Show all";
  favoritesChecked = !favoritesChecked;
  const products = await fetchProducts(1, currentPagination.pageSize, brandSelect.value, sortSelect.value, [showOnlySelectSale.checked, false, favoritesChecked]);

  setCurrentProducts(products);
  render(currentProducts, currentPagination);
}

selectShow.addEventListener('change', async (event) => {
  const products = await fetchProducts(1, parseInt(event.target.value), brandSelect.value, sortSelect.value, [showOnlySelectSale.checked, false, favoritesChecked]);

  setCurrentProducts(products);
  render(currentProducts, currentPagination);
});

brandSelect.addEventListener('change', async (event) => {
  const products = await fetchProducts(1, currentPagination.pageSize, event.target.value, sortSelect.value, [showOnlySelectSale.checked, false, favoritesChecked]);

  setCurrentProducts(products);
  render(currentProducts, currentPagination);
});

sortSelect.addEventListener('change', async (event) => {
  const products = await fetchProducts(1, currentPagination.pageSize, brandSelect.value, event.target.value, [showOnlySelectSale.checked, false, favoritesChecked]);

  setCurrentProducts(products);
  render(currentProducts, currentPagination);
});

showOnlySelectSale.addEventListener('change', async (event) => {
  const products = await fetchProducts(1, currentPagination.pageSize, brandSelect.value, sortSelect.value, [event.target.checked, false, favoritesChecked]);

  setCurrentProducts(products);
  render(currentProducts, currentPagination);
});

prevPage.addEventListener('click', async (event) => {
  if (currentPagination.currentPage === 1) {
    return;
  }
  const products = await fetchProducts(currentPagination.currentPage - 1, currentPagination.pageSize, brandSelect.value, sortSelect.value, [showOnlySelectSale.checked, false, favoritesChecked]);

  setCurrentProducts(products);
  render(currentProducts, currentPagination);
});

nextPage.addEventListener('click', async (event) => {
  if (currentPagination.currentPage === currentPagination.pageCount) {
    return;
  }
  const products = await fetchProducts(currentPagination.currentPage + 1, currentPagination.pageSize, brandSelect.value, sortSelect.value, [showOnlySelectSale.checked, false, favoritesChecked]);

  setCurrentProducts(products);
  render(currentProducts, currentPagination);
});

searchInput.addEventListener('change', async (event) => {
  const products = await fetchProducts(1, currentPagination.pageSize, brandSelect.value, sortSelect.value, [showOnlySelectSale.checked, false, favoritesChecked]);

  searchJustChanged = true;
  setCurrentProducts(products);
  render(currentProducts, currentPagination);
});

searchInput.addEventListener('keyup', async (event) => {
  const products = await fetchProducts(1, currentPagination.pageSize, brandSelect.value, sortSelect.value, [showOnlySelectSale.checked, false, favoritesChecked]);

  searchJustChanged = true;
  setCurrentProducts(products);
  render(currentProducts, currentPagination);
});

document.addEventListener('DOMContentLoaded', async () => {
  var elementsByLigne = parseInt((document.scrollingElement.clientWidth - 8) / 290);
  document.getElementById("show-select").innerHTML = `
  <option value="${3*elementsByLigne}">${3*elementsByLigne}</option>
  <option value="${6*elementsByLigne}">${6*elementsByLigne}</option>
  <option value="${9*elementsByLigne}">${9*elementsByLigne}</option>
  `

  const products = await fetchProducts(1,3*elementsByLigne);

  setCurrentProducts(products);
  render(currentProducts, currentPagination);
});