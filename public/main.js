
document.addEventListener('DOMContentLoaded', function() {
  const uploadForm = document.getElementById('upload-form');
  const fileInput = document.getElementById('file-input');
  const uploadBtn = document.getElementById('upload-btn');
  const loadingEl = document.getElementById('loading');
  const resultsContainer = document.getElementById('results-container');
  
  // File preview and info elements
  const previewImage = document.getElementById('preview-image');
  const fileName = document.getElementById('file-name');
  const fileFormat = document.getElementById('file-format');
  
  // Dimensions and material elements
  const dimLength = document.getElementById('dim-length');
  const dimWidth = document.getElementById('dim-width');
  const dimHeight = document.getElementById('dim-height');
  const volume = document.getElementById('volume');
  const materialName = document.getElementById('material-name');
  const weight = document.getElementById('weight');
  const cost = document.getElementById('cost');
  
  // Annotations and tolerances
  const annotationsList = document.getElementById('annotations-list');
  const tolerancesList = document.getElementById('tolerances-list');
  
  // Alternatives
  const alternativesTable = document.getElementById('alternatives-table');
  const comparisonMaterial = document.getElementById('comparison-material');
  const comparisonDetails = document.getElementById('comparison-details');
  
  // Store analysis results
  let currentAnalysis = null;
  
  // Handle file upload form submission
  uploadForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const file = fileInput.files[0];
    if (!file) {
      alert('Veuillez sélectionner un fichier');
      return;
    }
    
    // Show loading indicator
    loadingEl.classList.remove('d-none');
    resultsContainer.classList.add('d-none');
    uploadBtn.disabled = true;
    
    // Create form data
    const formData = new FormData();
    formData.append('file', file);
    
    // Send file to server
    fetch('/api/upload', {
      method: 'POST',
      body: formData
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Erreur lors du téléchargement');
      }
      return response.json();
    })
    .then(data => {
      // Hide loading indicator
      loadingEl.classList.add('d-none');
      uploadBtn.disabled = false;
      
      // Store analysis results
      currentAnalysis = data.analysis;
      
      // Display results
      displayResults(data);
      
      // Show results container
      resultsContainer.classList.remove('d-none');
    })
    .catch(error => {
      console.error('Error:', error);
      loadingEl.classList.add('d-none');
      uploadBtn.disabled = false;
      alert('Erreur: ' + error.message);
    });
  });
  
  // Display analysis results
  function displayResults(data) {
    const { file, analysis } = data;
    
    // Set file info
    fileName.textContent = file.originalName;
    fileFormat.textContent = file.extension.toUpperCase();
    
    // Check if a preview is available
    if (data.file.previewPath) {
      previewImage.src = data.file.previewPath;
    } else {
      previewImage.src = 'placeholder.svg';
    }
    
    // Set dimensions
    dimLength.textContent = analysis.dimensions.length.toFixed(2);
    dimWidth.textContent = analysis.dimensions.width.toFixed(2);
    dimHeight.textContent = analysis.dimensions.height.toFixed(2);
    volume.textContent = analysis.volume.toLocaleString();
    
    // Set material info
    materialName.textContent = analysis.material;
    weight.textContent = analysis.weight.toFixed(3);
    cost.textContent = analysis.cost.toFixed(2);
    
    // Display annotations
    annotationsList.innerHTML = '<h6>Annotations</h6>';
    if (analysis.annotations && analysis.annotations.length > 0) {
      const annotationsUl = document.createElement('ul');
      analysis.annotations.forEach(annotation => {
        const li = document.createElement('li');
        li.textContent = annotation;
        annotationsUl.appendChild(li);
      });
      annotationsList.appendChild(annotationsUl);
    } else {
      annotationsList.innerHTML += '<p>Aucune annotation</p>';
    }
    
    // Display tolerances
    tolerancesList.innerHTML = '<h6 class="mt-3">Tolérances</h6>';
    if (analysis.tolerances && analysis.tolerances.length > 0) {
      const tolerancesUl = document.createElement('ul');
      analysis.tolerances.forEach(tolerance => {
        const li = document.createElement('li');
        li.textContent = tolerance;
        tolerancesUl.appendChild(li);
      });
      tolerancesList.appendChild(tolerancesUl);
    } else {
      tolerancesList.innerHTML += '<p>Aucune tolérance spécifiée</p>';
    }
    
    // Display alternative materials
    displayAlternatives(analysis.alternatives);
    
    // Populate comparison dropdown
    comparisonMaterial.innerHTML = '';
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Sélectionnez un matériau';
    comparisonMaterial.appendChild(option);
    
    analysis.alternatives.forEach(alt => {
      const option = document.createElement('option');
      option.value = alt.name;
      option.textContent = alt.name;
      comparisonMaterial.appendChild(option);
    });
    
    // Clear comparison details
    comparisonDetails.innerHTML = '<p>Sélectionnez un matériau pour voir la comparaison détaillée</p>';
    
    // Add listener for comparison dropdown
    comparisonMaterial.addEventListener('change', function() {
      const selectedName = this.value;
      if (!selectedName) {
        comparisonDetails.innerHTML = '<p>Sélectionnez un matériau pour voir la comparaison détaillée</p>';
        return;
      }
      
      const selectedMaterial = analysis.alternatives.find(alt => alt.name === selectedName);
      if (selectedMaterial) {
        displayComparisonDetails(selectedMaterial);
      }
    });
  }
  
  // Display alternative materials
  function displayAlternatives(alternatives) {
    alternativesTable.innerHTML = '';
    
    if (!alternatives || alternatives.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="5" class="text-center">Aucune alternative trouvée</td>';
      alternativesTable.appendChild(row);
      return;
    }
    
    alternatives.forEach(alt => {
      const row = document.createElement('tr');
      row.className = 'material-row';
      row.dataset.material = alt.name;
      
      // Calculate weight difference
      const weightDiff = alt.comparison.weight.percent_change;
      const weightClass = weightDiff < 0 ? 'positive-change' : (weightDiff > 0 ? 'negative-change' : 'neutral-change');
      
      // Calculate cost difference
      const costDiff = alt.comparison.cost.percent_change;
      const costClass = costDiff < 0 ? 'positive-change' : (costDiff > 0 ? 'negative-change' : 'neutral-change');
      
      // Generate similarity badge color
      let badgeColor = 'bg-secondary';
      if (alt.similarity_score >= 90) {
        badgeColor = 'bg-success';
      } else if (alt.similarity_score >= 70) {
        badgeColor = 'bg-info';
      } else if (alt.similarity_score >= 50) {
        badgeColor = 'bg-warning';
      } else {
        badgeColor = 'bg-danger';
      }
      
      row.innerHTML = `
        <td>${alt.name}</td>
        <td>${alt.category}</td>
        <td class="${weightClass}">${weightDiff > 0 ? '+' : ''}${weightDiff.toFixed(1)}%</td>
        <td class="${costClass}">${costDiff > 0 ? '+' : ''}${costDiff.toFixed(1)}%</td>
        <td><span class="badge ${badgeColor} similarity-badge">${Math.round(alt.similarity_score)}</span></td>
      `;
      
      alternativesTable.appendChild(row);
      
      // Add click listener to select this material for comparison
      row.addEventListener('click', function() {
        comparisonMaterial.value = alt.name;
        // Trigger the change event
        const event = new Event('change');
        comparisonMaterial.dispatchEvent(event);
        
        // Scroll to comparison section
        comparisonDetails.scrollIntoView({ behavior: 'smooth' });
      });
    });
  }
  
  // Display detailed comparison
  function displayComparisonDetails(material) {
    comparisonDetails.innerHTML = '';
    
    const comparison = material.comparison;
    if (!comparison) {
      comparisonDetails.innerHTML = '<p>Données de comparaison non disponibles</p>';
      return;
    }
    
    // Create overview card
    const overviewCard = document.createElement('div');
    overviewCard.className = 'card mb-3';
    overviewCard.innerHTML = `
      <div class="card-header">
        <h6 class="mb-0">Vue d'ensemble de la comparaison</h6>
      </div>
      <div class="card-body">
        <p class="mb-1"><strong>Matériau original:</strong> ${currentAnalysis.material}</p>
        <p class="mb-1"><strong>Alternative:</strong> ${material.name}</p>
        <p class="mb-1"><strong>Score de similarité:</strong> ${Math.round(material.similarity_score)}%</p>
      </div>
    `;
    comparisonDetails.appendChild(overviewCard);
    
    // Create properties cards
    const propertiesContainer = document.createElement('div');
    propertiesContainer.className = 'row';
    
    // Weight comparison
    const weightCol = document.createElement('div');
    weightCol.className = 'col-md-6';
    const weightChange = comparison.weight.percent_change;
    const weightClass = weightChange < 0 ? 'positive-change' : (weightChange > 0 ? 'negative-change' : 'neutral-change');
    
    weightCol.innerHTML = `
      <div class="comparison-property">
        <h6>Poids</h6>
        <div class="d-flex justify-content-between">
          <div>
            <p class="mb-1"><strong>Original:</strong> ${comparison.weight.original.toFixed(3)} kg</p>
            <p class="mb-1"><strong>Alternative:</strong> ${comparison.weight.alternative.toFixed(3)} kg</p>
          </div>
          <div>
            <h4 class="${weightClass}">${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)}%</h4>
            <small>${comparison.weight.difference > 0 ? '+' : ''}${comparison.weight.difference.toFixed(3)} kg</small>
          </div>
        </div>
      </div>
    `;
    
    // Cost comparison
    const costCol = document.createElement('div');
    costCol.className = 'col-md-6';
    const costChange = comparison.cost.percent_change;
    const costClass = costChange < 0 ? 'positive-change' : (costChange > 0 ? 'negative-change' : 'neutral-change');
    
    costCol.innerHTML = `
      <div class="comparison-property">
        <h6>Coût estimé</h6>
        <div class="d-flex justify-content-between">
          <div>
            <p class="mb-1"><strong>Original:</strong> ${comparison.cost.original.toFixed(2)} €</p>
            <p class="mb-1"><strong>Alternative:</strong> ${comparison.cost.alternative.toFixed(2)} €</p>
          </div>
          <div>
            <h4 class="${costClass}">${costChange > 0 ? '+' : ''}${costChange.toFixed(1)}%</h4>
            <small>${comparison.cost.difference > 0 ? '+' : ''}${comparison.cost.difference.toFixed(2)} €</small>
          </div>
        </div>
      </div>
    `;
    
    propertiesContainer.appendChild(weightCol);
    propertiesContainer.appendChild(costCol);
    
    // Add mechanical properties
    const mechanicalProps = ['tensile_strength', 'yield_strength', 'elastic_modulus'];
    const propNames = {
      tensile_strength: 'Résistance à la traction',
      yield_strength: 'Limite d\'élasticité',
      elastic_modulus: 'Module d\'élasticité'
    };
    
    const propUnits = {
      tensile_strength: 'MPa',
      yield_strength: 'MPa',
      elastic_modulus: 'GPa'
    };
    
    mechanicalProps.forEach((prop, index) => {
      if (comparison[prop]) {
        const propCol = document.createElement('div');
        propCol.className = 'col-md-4';
        
        const change = comparison[prop].percent_change;
        const changeClass = change > 0 ? 'positive-change' : (change < 0 ? 'negative-change' : 'neutral-change');
        
        propCol.innerHTML = `
          <div class="comparison-property">
            <h6>${propNames[prop]}</h6>
            <div class="d-flex justify-content-between">
              <div>
                <p class="mb-1"><strong>Original:</strong> ${comparison[prop].original} ${propUnits[prop]}</p>
                <p class="mb-1"><strong>Alternative:</strong> ${comparison[prop].alternative} ${propUnits[prop]}</p>
              </div>
              <div>
                <h4 class="${changeClass}">${change > 0 ? '+' : ''}${change.toFixed(1)}%</h4>
              </div>
            </div>
          </div>
        `;
        
        propertiesContainer.appendChild(propCol);
      }
    });
    
    comparisonDetails.appendChild(propertiesContainer);
    
    // Add material properties comparison
    const materialPropsCard = document.createElement('div');
    materialPropsCard.className = 'card mt-3';
    materialPropsCard.innerHTML = `
      <div class="card-header">
        <h6 class="mb-0">Propriétés du matériau</h6>
      </div>
      <div class="card-body">
        <div class="row">
          <div class="col-md-6">
            <p><strong>Densité:</strong> ${material.density} g/cm³</p>
            <p><strong>Coût par kg:</strong> ${material.cost_per_kg} €/kg</p>
            <p><strong>Résistance à la corrosion:</strong> ${material.corrosion_resistance}</p>
          </div>
          <div class="col-md-6">
            <p><strong>Usinabilité:</strong> ${material.machinability}/100</p>
            <p><strong>Soudabilité:</strong> ${material.weldability}/100</p>
            <p><strong>Utilisations courantes:</strong> ${material.common_uses}</p>
          </div>
        </div>
      </div>
    `;
    
    comparisonDetails.appendChild(materialPropsCard);
  }
});
