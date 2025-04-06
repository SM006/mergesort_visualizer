let scene, camera, renderer, controls;
let bars = [];
let array = [];
let speed = 200;
let is3DMode = false;
let font;
let animationInProgress = false;

// DOM elements
const arraySizeInput = document.getElementById("arraySize");
const speedInput = document.getElementById("speed");
const visualizationMode = document.getElementById("visualizationMode");
const maxSpeed = 700;
let sorting = false;

// Initialize draggable controls
function initDraggableControls() {
  const controls = document.querySelector('.controls');
  
  // Add drag handle to controls if it doesn't already exist
  let dragHandle = controls.querySelector('.drag-handle');
  if (!dragHandle) {
    dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    controls.prepend(dragHandle);
  }
  
  let isDragging = false;
  let offsetX, offsetY;
  
  // When the user clicks on the drag handle (not the entire controls), start the drag
  dragHandle.addEventListener('mousedown', function(e) {
    // Reset transform to get accurate position
    const computedStyle = window.getComputedStyle(controls);
    const transform = computedStyle.getPropertyValue('transform');
    
    if (transform !== 'none' && transform !== 'matrix(1, 0, 0, 1, 0, 0)') {
      const matrix = new DOMMatrix(transform);
      const currentX = matrix.m41;
      const currentY = matrix.m42;
      
      controls.style.left = currentX + 'px';
      controls.style.top = currentY + 'px';
      controls.style.transform = 'none';
    }
    
    isDragging = true;
    
    // Calculate the offset
    const rect = controls.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    
    // Add a class to indicate dragging
    controls.classList.add('dragging');
    
    // Prevent text selection during drag
    e.preventDefault();
  });
  
  // When the user moves the mouse, move the controls
  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    
    // Calculate new position
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;
    
    // Keep controls within viewport bounds
    const maxX = window.innerWidth - controls.offsetWidth;
    const maxY = window.innerHeight - controls.offsetHeight;
    
    const boundedX = Math.max(0, Math.min(x, maxX));
    const boundedY = Math.max(0, Math.min(y, maxY));
    
    controls.style.left = boundedX + 'px';
    controls.style.top = boundedY + 'px';
    controls.style.transform = 'none';
  });
  
  // When the user releases the mouse, stop the drag
  document.addEventListener('mouseup', function() {
    if (isDragging) {
      isDragging = false;
      controls.classList.remove('dragging');
      
      // Save position in localStorage for persistence
      const rect = controls.getBoundingClientRect();
      localStorage.setItem('controlsPosition', JSON.stringify({
        left: rect.left,
        top: rect.top
      }));
    }
  });
  
  // Load saved position on startup
  const savedPosition = localStorage.getItem('controlsPosition');
  if (savedPosition) {
    try {
      const { left, top } = JSON.parse(savedPosition);
      controls.style.left = left + 'px';
      controls.style.top = top + 'px';
      controls.style.transform = 'none';
    } catch (e) {
      console.error('Failed to load saved controls position:', e);
    }
  }
}

// Initialize Three.js scene
function initThreeJS() {
  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  // Create camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 50, 100);

  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  
  // Check if container exists, create it if not
  let container = document.getElementById('canvas-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'canvas-container';
    document.body.appendChild(container);
  }
  container.appendChild(renderer.domElement);

  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  // Add directional light with shadows
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(50, 100, 50);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 500;
  scene.add(directionalLight);

  // Add a floor for shadows
  const floorGeometry = new THREE.PlaneGeometry(500, 500);
  const floorMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x111122, 
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8
  });
  
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = Math.PI / 2;
  floor.position.y = -0.5;
  floor.receiveShadow = true;
  scene.add(floor);

  // Add grid helper
  const gridHelper = new THREE.GridHelper(500, 50, 0x444444, 0x222222);
  gridHelper.position.y = -0.4;
  scene.add(gridHelper);

  // Add orbit controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.5;
  controls.maxDistance = 300;
  controls.minDistance = 20;

  // Add fog to the scene
  scene.fog = new THREE.FogExp2(0x000000, 0.002);

  // Handle window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Load font for text on bars
  const fontLoader = new THREE.FontLoader();
  fontLoader.load('https://cdn.jsdelivr.net/npm/three@0.137.0/examples/fonts/helvetiker_regular.typeface.json', function(loadedFont) {
    font = loadedFont;
    // Now that the font is loaded, generate the array
    generateArray();
  });

  // Start animation loop
  animate();

  // Initialize draggable controls
  initDraggableControls();
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  if (is3DMode) {
    controls.update();
    
    // Update position & rotation of value labels to face camera
    if (bars.length > 0 && font) {
      bars.forEach(bar => {
        if (bar.userData && bar.userData.textMesh) {
          bar.userData.textMesh.lookAt(camera.position);
        }
      });
    }
    
    renderer.render(scene, camera);
  }
}

// Create a 3D bar for the visualization
function createBar(value, index, total) {
  if (!is3DMode) {
    return create2DBar(value, index, total);
  }
  
  // Calculate maximum width based on array size
  const maxBarWidth = Math.min(4, 100 / total);
  const height = value;
  const width = maxBarWidth;
  const depth = maxBarWidth;
  
  // Calculate position
  const spacing = maxBarWidth * 1.2;
  const totalWidth = total * (width + spacing);
  const startX = -totalWidth / 2 + width / 2;
  const x = startX + index * (width + spacing);
  
  // Create geometry and material with custom shaders for better look
  const geometry = new THREE.BoxGeometry(width, height, depth);
  
  // Create material with gradient
  const material = new THREE.MeshPhongMaterial({ 
    color: 0x00a0ff,
    emissive: 0x003366,
    specular: 0x6699ff,
    shininess: 30
  });
  
  // Create mesh
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, height / 2, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  
  // Add value as 3D text if font is loaded
  if (font) {
    // Scale text size based on array size
    const textSize = Math.max(0.8, 2.5 - (total * 0.02));
    
    const textGeometry = new THREE.TextGeometry(value.toString(), {
      font: font,
      size: textSize,
      height: 0.1,
      curveSegments: 12
    });
    
    const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    
    // Center the text
    textGeometry.computeBoundingBox();
    const textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
    
    // Position the text above the bar
    textMesh.position.set(x - textWidth / 2, height + 2, 0);
    
    // Group the bar and its text
    const group = new THREE.Group();
    group.add(mesh);
    group.add(textMesh);
    
    // Store original height and value in the group for animations
    group.userData = { 
      originalY: height / 2, 
      value: value, 
      barMesh: mesh, 
      textMesh: textMesh,
      startPosition: { x: x, y: 0, z: 0 }
    };
    
    return group;
  }
  
  return mesh;
}

// Create a 2D bar for visualization
function create2DBar(value, index, total) {
  const barContainer = document.getElementById('bar-container');
  
  // More adaptive width calculation for better visibility
  const barWidth = Math.max(4, Math.min(30, 800 / total));
  const gap = Math.max(1, Math.min(4, 200 / total));
  
  // Create a div element for the bar
  const bar = document.createElement('div');
  bar.className = 'bar';
  
  // Calculate height, ensuring even small values have some visibility
  const heightValue = Math.max(5, value * 5); // Minimum height of 5px
  bar.style.height = `${heightValue}px`;
  
  bar.style.width = `${barWidth}px`;
  bar.style.marginLeft = `${gap}px`;
  bar.style.marginRight = `${gap}px`;
  
  // Enhanced visual for small values
  if (value < 20) {
    bar.setAttribute('data-small-value', 'true');
    // Add a distinct gradient for small values to make them stand out
    bar.style.background = 'linear-gradient(180deg, #00ffcc, #003366)';
    bar.style.boxShadow = '0 0 10px rgba(0, 255, 204, 0.6)';
  } else {
    // Regular bars
    bar.style.background = 'linear-gradient(180deg, #00a0ff, #003366)';
    bar.style.boxShadow = '0 0 10px rgba(0, 160, 255, 0.5)';
  }
  
  // Add value display
  const valueDisplay = document.createElement('span');
  valueDisplay.className = 'bar-value';
  valueDisplay.textContent = value;
  
  // ALWAYS position values above the bars
  valueDisplay.style.bottom = 'auto';
  valueDisplay.style.top = '-25px';
  
  // For very small values, add extra styling to the value display
  if (value < 20) {
    valueDisplay.style.fontWeight = 'bold';
    valueDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    valueDisplay.style.boxShadow = '0 0 5px rgba(0, 255, 204, 0.6)';
  }
  
  bar.appendChild(valueDisplay);
  barContainer.appendChild(bar);
  
  return bar;
}

// Generate a new random array and visualize it
function generateArray() {
  if (sorting) return;
  
  const size = +arraySizeInput.value;
  document.getElementById('arraySizeValue').textContent = size;
  
  // Scale values based on array size to maintain visibility
  const maxValue = 150 - size * 0.5;  // Decrease max value as array size increases
  array = Array.from({ length: size }, () => Math.floor(Math.random() * maxValue) + 10);
  
  renderBars(array);
  
  // Add an introduction animation effect
  animateNewArray();
}

// Introduction animation for newly generated arrays
function animateNewArray() {
  if (is3DMode) {
    animationInProgress = true;
    
    // Scale bars from 0 to full height with staggered timing
    bars.forEach((bar, i) => {
      // Save the original scale
      const originalScale = bar.userData ? bar.userData.barMesh.scale.y : bar.scale.y;
      
      // Set initial scale to 0
      if (bar.userData && bar.userData.barMesh) {
        bar.userData.barMesh.scale.y = 0;
        if (bar.userData.textMesh) {
          bar.userData.textMesh.visible = false;
        }
      } else {
        bar.scale.y = 0;
      }
      
      // Animate to full scale with a staggered delay
      setTimeout(() => {
        const startTime = Date.now();
        const duration = 500; // milliseconds
        
        function scaleUp() {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easeProgress = easeOutBack(progress);
          
          if (bar.userData && bar.userData.barMesh) {
            bar.userData.barMesh.scale.y = easeProgress;
            if (progress >= 1 && bar.userData.textMesh) {
              bar.userData.textMesh.visible = true;
            }
          } else {
            bar.scale.y = easeProgress;
          }
          
          if (progress < 1) {
            requestAnimationFrame(scaleUp);
          } else if (i === bars.length - 1) {
            animationInProgress = false;
          }
        }
        
        scaleUp();
      }, i * 30); // Staggered delay based on index
    });
  } else {
    // For 2D bars
    bars.forEach((bar, i) => {
      bar.style.height = "0px";
      setTimeout(() => {
        bar.style.height = `${array[i] * 5}px`;
      }, i * 30);
    });
  }
}

// Easing function for smoother animations
function easeOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

// Render the bars for the current array
function renderBars(arr) {
  if (is3DMode) {
    // Remove existing 3D bars
    bars.forEach(bar => scene.remove(bar));
  } else {
    // Clear 2D container
    document.getElementById('bar-container').innerHTML = '';
  }
  
  bars = [];
  
  // Create new bars
  arr.forEach((value, index) => {
    const bar = createBar(value, index, arr.length);
    if (is3DMode) {
      scene.add(bar);
    }
    bars.push(bar);
  });
}

// Toggle between 2D and 3D visualization
function toggleVisualizationMode() {
  is3DMode = visualizationMode.value === '3d';
  
  // Toggle visibility of containers
  document.getElementById('canvas-container').style.display = is3DMode ? 'block' : 'none';
  document.getElementById('bar-container').style.display = is3DMode ? 'none' : 'flex';
  
  // Re-render with current mode
  renderBars(array);
  
  // Add animation when switching modes
  animateNewArray();
  
  // Enable auto-rotation in 3D mode for a moment
  if (is3DMode && controls) {
    controls.autoRotate = true;
    setTimeout(() => {
      controls.autoRotate = false;
    }, 2000);
  }
}

// Start the merge sort visualization
async function startMergeSort() {
  if (sorting || animationInProgress) return;
  
  sorting = true;
  const controlsPanel = document.querySelector('.controls');
  controlsPanel.classList.add('sorting');
  
  document.getElementById('sortButton').disabled = true;
  document.getElementById('generateButton').disabled = true;
  arraySizeInput.disabled = true;
  visualizationMode.disabled = true;
  
  try {
    await mergeSort(array, 0, array.length - 1);
    // Show completion animation
    await completionAnimation();
  } finally {
    sorting = false;
    controlsPanel.classList.remove('sorting');
    document.getElementById('sortButton').disabled = false;
    document.getElementById('generateButton').disabled = false;
    arraySizeInput.disabled = false;
    visualizationMode.disabled = false;
  }
}

// Completion animation after sorting is done
async function completionAnimation() {
  // Enable auto-rotation in 3D mode to show off the sorted array
  if (is3DMode) {
    controls.autoRotate = true;
    setTimeout(() => {
      controls.autoRotate = false;
    }, 3000);
  }
  
  for (let i = 0; i < bars.length; i++) {
    if (is3DMode) {
      const bar = bars[i].userData ? bars[i].userData.barMesh : bars[i];
      // Green success color
      bar.material.color.set(0x00ff00);
      bar.material.emissive.set(0x009900);
      
      // Add a slight "hop" animation
      const startY = bars[i].position.y;
      const hopHeight = 5;
      const animationDuration = 300;
      const startTime = Date.now();
      
      await new Promise(resolve => {
        function hop() {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / animationDuration, 1);
          
          // Hop up and down using sine function
          const yOffset = Math.sin(progress * Math.PI) * hopHeight;
          bars[i].position.y = startY + yOffset;
          
          if (progress < 1) {
            requestAnimationFrame(hop);
          } else {
            bars[i].position.y = startY;
            resolve();
          }
        }
        
        hop();
      });
    } else {
      // For 2D bars - match the 3D green color scheme
      bars[i].style.background = 'linear-gradient(180deg, #00ff00, #009900)';
      bars[i].style.boxShadow = '0 0 15px rgba(0, 255, 0, 0.6)';
      bars[i].classList.add('success');
      bars[i].style.transform = 'translateY(0)';
      
      // Add a transition delay for cascading effect
      await sleep(30);
    }
  }
}

// Merge sort algorithm
async function mergeSort(arr, l, r) {
  if (l >= r) return;

  const mid = Math.floor((l + r) / 2);
  await mergeSort(arr, l, mid);
  await mergeSort(arr, mid + 1, r);
  await merge(arr, l, mid, r);
}

// Merge function to combine two sorted arrays
async function merge(arr, l, mid, r) {
  // Highlight the section being merged
  for (let i = l; i <= r; i++) {
    if (is3DMode) {
      const bar = bars[i].userData ? bars[i].userData.barMesh : bars[i];
      bar.material.color.set(0x64ef00);
      bar.material.emissive.set(0x2a6400);
      
      // Only perform animation at lower speeds
      if (speed < 600) {
        // Lift animation code remains the same...
      }
    } else {
      if (speed < 800) { // Skip animations for very fast speeds
        // Update 2D styles to match 3D colors
        bars[i].classList.add('down');
        bars[i].style.background = 'linear-gradient(180deg, #64ef00, #2a6400)';
        bars[i].style.boxShadow = '0 0 15px rgba(100, 239, 0, 0.6)';
      }
    }
  }
  
  // Super aggressive speed optimization
  let visualDelay;
  if (speed > 950) {
    visualDelay = 0; // Essentially no delay
  } else if (speed > 900) {
    visualDelay = 1; // Almost instantaneous
  } else if (speed > 700) {
    visualDelay = 5; // Extremely fast
  } else if (speed > 500) {
    visualDelay = 20; // Very fast
  } else {
    visualDelay = Math.max(30, 1000 - speed * 1.2); // Normal to slow speeds
  }
  
  // For very fast speed, batch updates
  const batchMode = speed > 700;
  const skipAnimations = speed > 900;
  
  if (!skipAnimations) {
    await sleep(visualDelay);
  }
  
  const left = arr.slice(l, mid + 1);
  const right = arr.slice(mid + 1, r + 1);
  let i = 0, j = 0, k = l;
  
  // Batch updates for high speeds
  let updateBatch = [];
  const batchSize = speed > 900 ? 50 : (speed > 800 ? 25 : 10);
  
  // Merge the arrays
  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) {
      arr[k] = left[i++];
    } else {
      arr[k] = right[j++];
    }
    
    if (batchMode) {
      updateBatch.push({index: k, value: arr[k]});
      if (updateBatch.length >= batchSize) {
        await updateBatchBars(updateBatch);
        updateBatch = [];
      }
    } else {
      await updateBar(k, arr[k]);
      await sleep(visualDelay / 2);
    }
    k++;
  }
  
  // Handle remaining elements with similar batching approach
  while (i < left.length) {
    arr[k] = left[i++];
    
    if (batchMode) {
      updateBatch.push({index: k, value: arr[k]});
      if (updateBatch.length >= batchSize) {
        await updateBatchBars(updateBatch);
        updateBatch = [];
      }
    } else {
      await updateBar(k, arr[k]);
      await sleep(visualDelay / 2);
    }
    k++;
  }
  
  while (j < right.length) {
    arr[k] = right[j++];
    
    if (batchMode) {
      updateBatch.push({index: k, value: arr[k]});
      if (updateBatch.length >= batchSize) {
        await updateBatchBars(updateBatch);
        updateBatch = [];
      }
    } else {
      await updateBar(k, arr[k]);
      await sleep(visualDelay / 2);
    }
    k++;
  }
  
  // Process any remaining updates in batch
  if (updateBatch.length > 0) {
    await updateBatchBars(updateBatch);
  }
  
  // Reset visual state - skip animations for very fast speeds
  if (skipAnimations) {
    // Instant reset without animations
    for (let i = l; i <= r; i++) {
      if (is3DMode) {
        const bar = bars[i].userData ? bars[i].userData.barMesh : bars[i];
        bar.material.color.set(0x09a086);
        bar.material.emissive.set(0x095a50);
        bars[i].position.y = 0; // Just reset immediately
      } else {
        // Match 2D colors to 3D reset colors
        bars[i].classList.remove('down');
        bars[i].style.background = 'linear-gradient(180deg, #09a086, #095a50)';
        bars[i].style.boxShadow = '0 0 15px rgba(9, 160, 134, 0.6)';
      }
    }
  } else {
    // Standard animation reset
    for (let i = l; i <= r; i++) {
      if (is3DMode) {
        const bar = bars[i].userData ? bars[i].userData.barMesh : bars[i];
        bar.material.color.set(0x09a086);
        bar.material.emissive.set(0x095a50);
        
        // Return to original position with smooth animation
        const targetY = 0;
        const animationDuration = Math.max(50, 200 - speed/5);
        const startTime = Date.now();
        const startY = bars[i].position.y;
        
        await new Promise(resolve => {
          function lower() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / animationDuration, 1);
            
            // Smooth easing
            const easedProgress = easeOutCubic(progress);
            bars[i].position.y = startY + (targetY - startY) * easedProgress;
            
            if (progress < 1) {
              requestAnimationFrame(lower);
            } else {
              resolve();
            }
          }
          
          lower();
        });
      } else {
        bars[i].classList.remove('down');
        bars[i].style.backgroundColor = 'rgb(9, 103, 89)';
      }
    }
  }
}

// Add this new function to update multiple bars at once for high speeds
async function updateBatchBars(updates) {
  if (is3DMode) {
    // For 3D mode, update all bars in batch at once
    updates.forEach(update => {
      scene.remove(bars[update.index]);
      const bar = createBar(update.value, update.index, array.length);
      scene.add(bar);
      
      const meshToColor = bar.userData ? bar.userData.barMesh : bar;
      meshToColor.material.color.set(0x2e8b57);
      meshToColor.material.emissive.set(0x1a5733);
      
      bars[update.index] = bar;
    });
    
    // Brief delay to allow rendering
    await sleep(1);
  } else {
    // For 2D mode - use the same colors as 3D
    updates.forEach(update => {
      bars[update.index].style.height = `${update.value * 5}px`;
      // Update the value and make sure it's visible
      const valueDisplay = bars[update.index].querySelector('.bar-value');
      valueDisplay.textContent = update.value;
      // Ensure it's positioned above the bar
      valueDisplay.style.top = '-25px';
      valueDisplay.style.bottom = 'auto';
      
      bars[update.index].classList.add('merged');
      bars[update.index].style.background = 'linear-gradient(180deg, #09a086, #095a50)';
      bars[update.index].style.boxShadow = '0 0 15px rgba(9, 160, 134, 0.6)';
    });
    
    // Brief delay
    await sleep(1);
  }
}

// Cubic easing function for smoother animations
function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3);
}

// Update a bar's height and position with smooth animation
async function updateBar(index, value) {
  if (is3DMode) {
    scene.remove(bars[index]);
    
    const bar = createBar(value, index, array.length);
    scene.add(bar);
    
    // Add a "merged" highlight effect
    const meshToColor = bar.userData ? bar.userData.barMesh : bar;
    meshToColor.material.color.set(0x2e8b57);
    meshToColor.material.emissive.set(0x1a5733);
    
    // Add a subtle scale animation
    const originalScale = { x: meshToColor.scale.x, y: meshToColor.scale.y, z: meshToColor.scale.z };
    const targetScale = 1.2;
    const animationDuration = 200;
    const startTime = Date.now();
    
    await new Promise(resolve => {
      function scaleAnimation() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);
        
        if (progress < 0.5) {
          // Scale up
          const scaleProgress = progress * 2; // Normalize to 0-1
          meshToColor.scale.x = originalScale.x * (1 + (targetScale - 1) * scaleProgress);
          meshToColor.scale.z = originalScale.z * (1 + (targetScale - 1) * scaleProgress);
        } else {
          // Scale down
          const scaleProgress = (progress - 0.5) * 2; // Normalize to 0-1
          meshToColor.scale.x = originalScale.x * (targetScale - (targetScale - 1) * scaleProgress);
          meshToColor.scale.z = originalScale.z * (targetScale - (targetScale - 1) * scaleProgress);
        }
        
        if (progress < 1) {
          requestAnimationFrame(scaleAnimation);
        } else {
          // Reset to original scale
          meshToColor.scale.x = originalScale.x;
          meshToColor.scale.z = originalScale.z;
          resolve();
        }
      }
      
      scaleAnimation();
    });
    
    bars[index] = bar;
  } else {
    // Update 2D bar with animation
    const currentHeight = parseInt(bars[index].style.height);
    const targetHeight = value * 5;
    const animationDuration = 200;
    const startTime = Date.now();
    
    await new Promise(resolve => {
      function updateHeight() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);
        
        // Smooth easing
        const easedProgress = easeOutCubic(progress);
        const newHeight = currentHeight + (targetHeight - currentHeight) * easedProgress;
        
        bars[index].style.height = `${newHeight}px`;
        
        if (progress < 1) {
          requestAnimationFrame(updateHeight);
        } else {
          // Update value and ensure it's positioned correctly
          const valueDisplay = bars[index].querySelector('.bar-value');
          valueDisplay.textContent = value;
          valueDisplay.style.top = '-25px';
          valueDisplay.style.bottom = 'auto';
          
          bars[index].classList.add('merged');
          resolve();
        }
      }
      
      updateHeight();
    });
  }
}

// Helper sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Update speed display text
function updateSpeedText() {
  const speedValue = speedInput.value;
  let speedText;
  
  // Higher values = faster speeds
  if (speedValue > 950) {
    speedText = 'Instant';
  } else if (speedValue > 900) {
    speedText = 'Ultra Fast';
  } else if (speedValue > 750) {
    speedText = 'Very Fast';
  } else if (speedValue > 500) {
    speedText = 'Fast';
  } else if (speedValue > 350) {
    speedText = 'Medium';
  } else {
    speedText = 'Slow';
  }
  
  document.getElementById('speedValue').textContent = speedText;
}

// Event listeners
arraySizeInput.addEventListener("input", () => {
  document.getElementById('arraySizeValue').textContent = arraySizeInput.value;
  generateArray();
});

speedInput.addEventListener("input", () => {
  // Invert the slider value to make higher = faster
  speed = +speedInput.value; // No need to use maxSpeed - value
  updateSpeedText();
});

visualizationMode.addEventListener("change", toggleVisualizationMode);

// When the page loads, set the speed to a high value by default
document.addEventListener('DOMContentLoaded', function() {
  // Set default to 2D mode
  is3DMode = false;
  visualizationMode.value = "2d";
  
  // Set default speed to very fast
  speedInput.value = 900;
  speed = 900;
  updateSpeedText();
  
  // Generate the initial array
  generateArray();
});

// Initialize
updateSpeedText();
initThreeJS();