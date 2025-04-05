console.log("Script loaded");
let array = [];
let speed = 200;

const barContainer = document.getElementById("barContainer");
const arraySizeInput = document.getElementById("arraySize");
const speedInput = document.getElementById("speed");

arraySizeInput.addEventListener("input", generateArray);
const maxSpeed = 700;
speedInput.addEventListener("input", () => {
  speed = maxSpeed - +speedInput.value;
});

  

function generateArray() {
  console.log("Generating array...");
  const size = +arraySizeInput.value;
  array = Array.from({ length: size }, () => Math.floor(Math.random() * 100) + 10);
  console.log("Generated array:", array);
  renderBars(array);
}


function renderBars(arr) {
  console.log("Rendering bars...");
  barContainer.innerHTML = "";
  const width = Math.floor(barContainer.clientWidth / arr.length) - 4;
  arr.forEach((value, i) => {
    const bar = document.createElement("div");
    bar.classList.add("bar");
    bar.style.height = `${value * 3}px`;
    bar.style.width = `${width}px`;
    bar.innerText = value;
    barContainer.appendChild(bar);
  });
}


async function startMergeSort() {
  await mergeSort(array, 0, array.length - 1);
}

async function mergeSort(arr, l, r) {
  if (l >= r) return;

  const mid = Math.floor((l + r) / 2);
  await mergeSort(arr, l, mid);
  await mergeSort(arr, mid + 1, r);
  await merge(arr, l, mid, r);
}

async function merge(arr, l, mid, r) {
  const bars = document.querySelectorAll(".bar");
  const left = arr.slice(l, mid + 1);
  const right = arr.slice(mid + 1, r + 1);
  let i = 0, j = 0, k = l;

  for (let x = l; x <= r; x++) {
    bars[x].classList.add("down");
  }
  await sleep(speed);

  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) {
      arr[k] = left[i++];
    } else {
      arr[k] = right[j++];
    }
    bars[k].style.height = `${arr[k] * 3}px`;
    bars[k].innerText = arr[k];
    bars[k].classList.remove("down");
    bars[k].classList.add("merged");
    await sleep(speed);
    bars[k].classList.remove("merged");
    k++;
  }

  while (i < left.length) {
    arr[k] = left[i++];
    bars[k].style.height = `${arr[k] * 3}px`;
    bars[k].innerText = arr[k];
    bars[k].classList.remove("down");
    await sleep(speed);
    k++;
  }

  while (j < right.length) {
    arr[k] = right[j++];
    bars[k].style.height = `${arr[k] * 3}px`;
    bars[k].innerText = arr[k];
    bars[k].classList.remove("down");
    await sleep(speed);
    k++;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

generateArray(); 
