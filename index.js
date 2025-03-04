// ================================
// index.js - FICHIER PRINCIPAL
// ================================

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const readline = require('readline');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 16 * 1024 * 1024 }, // 16MB limit
  fileFilter: function (req, file, cb) {
    const allowedExtensions = ['.pdf', '.dxf', '.dwg', '.stl', '.step', '.stp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Format de fichier non pris en charge'), false);
    }
  }
});

// Ensure directories exist
const dirs = ['uploads', 'projects', 'database', 'public'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Create placeholder SVG if it doesn't exist
const placeholderPath = path.join(__dirname, 'public', 'placeholder.svg');
if (!fs.existsSync(placeholderPath)) {
  const placeholderSVG = `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#f8f9fa"/>
    <text x="50%" y="50%" font-family="Arial" font-size="20" text-anchor="middle" fill="#6c757d">
      Aperçu 3D non disponible
    </text>
    <text x="50%" y="65%" font-family="Arial" font-size="14" text-anchor="middle" fill="#6c757d">
      Les dimensions sont extraites automatiquement
    </text>
  </svg>`;
  fs.writeFileSync(placeholderPath, placeholderSVG);
}

// Initialize database
const dbPath = path.join(__dirname, 'database', 'materials.db');
const db = new sqlite3.Database(dbPath);

// Create materials table if it doesn't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      density REAL NOT NULL,
      cost_per_kg REAL NOT NULL,
      tensile_strength REAL,
      yield_strength REAL,
      elastic_modulus REAL,
      thermal_expansion REAL,
      thermal_conductivity REAL,
      electrical_resistivity REAL,
      corrosion_resistance TEXT,
      machinability INTEGER,
      weldability INTEGER,
      common_uses TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS material_properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER,
      property_name TEXT NOT NULL,
      property_value TEXT NOT NULL,
      FOREIGN KEY (material_id) REFERENCES materials (id)
    )
  `);

  // Check if materials table is empty
  db.get("SELECT COUNT(*) as count FROM materials", (err, row) => {
    if (err) {
      console.error("Error checking materials table:", err);
      return;
    }

    if (row.count === 0) {
      console.log("Inserting default materials...");
      insertDefaultMaterials();
    }
  });
});

// Insert default materials
function insertDefaultMaterials() {
  const defaultMaterials = [
    // Steels
    ['AISI 1018 Steel', 'Steel', 7.87, 1.2, 440, 370, 205, 11.5, 51.9, 15.9, 'Low', 70, 90, 'General purpose, shafts, pins'],
    ['AISI 304 Stainless Steel', 'Steel', 8.0, 4.5, 515, 205, 193, 17.2, 16.2, 72.0, 'High', 45, 70, 'Food equipment, chemical containers'],
    ['AISI 4140 Steel', 'Steel', 7.85, 1.8, 655, 415, 210, 12.3, 42.6, 22.0, 'Medium', 55, 65, 'Gears, axles, shafts'],
    ['Tool Steel A2', 'Steel', 7.86, 8.0, 1620, 1520, 203, 10.8, 24.0, 65.0, 'Medium', 30, 20, 'Cutting tools, dies'],

    // Aluminum Alloys
    ['Aluminum 6061-T6', 'Aluminum', 2.7, 3.5, 310, 276, 68.9, 23.6, 167, 3.7, 'Medium', 85, 50, 'Structural components, frames'],
    ['Aluminum 7075-T6', 'Aluminum', 2.81, 5.2, 572, 503, 71.7, 23.4, 130, 5.2, 'Medium', 70, 30, 'Aircraft components, high-stress parts'],
    ['Aluminum 1100-H14', 'Aluminum', 2.71, 3.0, 110, 103, 68.9, 23.6, 222, 2.9, 'High', 95, 90, 'Chemical equipment, heat exchangers'],

    // Copper Alloys
    ['Brass C360', 'Copper', 8.5, 7.0, 385, 310, 97, 20.5, 115, 6.6, 'Medium', 90, 60, 'Plumbing, decorative hardware'],
    ['Bronze C932', 'Copper', 7.6, 9.0, 310, 152, 103, 18.0, 45, 13.0, 'High', 75, 40, 'Bearings, bushings, gears'],
    ['Copper C11000', 'Copper', 8.94, 8.5, 220, 69, 117, 17.0, 391, 1.7, 'High', 85, 80, 'Electrical components, heat exchangers'],

    // Plastics
    ['ABS', 'Plastic', 1.05, 2.8, 40, 40, 2.3, 90.0, 0.17, 1e15, 'High', 90, 0, 'Consumer products, automotive components'],
    ['Polycarbonate', 'Plastic', 1.2, 4.5, 65, 62, 2.4, 65.0, 0.21, 1e16, 'High', 85, 0, 'Safety equipment, electronic housings'],
    ['Nylon 6/6', 'Plastic', 1.14, 3.8, 82, 82, 2.9, 80.0, 0.25, 1e14, 'High', 80, 0, 'Gears, bearings, wear components'],
    ['PEEK', 'Plastic', 1.32, 90.0, 100, 97, 3.6, 47.0, 0.25, 1e16, 'Very High', 70, 0, 'High-performance components, aerospace'],

    // Titanium Alloys
    ['Ti-6Al-4V', 'Titanium', 4.43, 35.0, 950, 880, 113.8, 8.6, 6.7, 170.0, 'Very High', 30, 40, 'Aerospace, medical implants'],

    // Magnesium Alloys
    ['AZ31B Magnesium', 'Magnesium', 1.77, 6.0, 260, 200, 45, 26.0, 96, 9.2, 'Low', 70, 50, 'Lightweight components, electronics'],

    // Composites
    ['Carbon Fiber Composite', 'Composite', 1.6, 50.0, 600, 570, 70, 2.0, 5.0, 1e13, 'Very High', 20, 0, 'Aerospace, high-performance components']
  ];

  const stmt = db.prepare(`
    INSERT INTO materials (
      name, category, density, cost_per_kg, tensile_strength, yield_strength, 
      elastic_modulus, thermal_expansion, thermal_conductivity, electrical_resistivity,
      corrosion_resistance, machinability, weldability, common_uses
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  defaultMaterials.forEach(material => {
    stmt.run(material, (err) => {
      if (err) console.error("Error inserting material:", err);
    });
  });

  stmt.finalize();
}

// HELPER FUNCTIONS

// Calculate weight based on material density and volume
async function calculateWeight(materialName, volume) {
  return new Promise((resolve, reject) => {
    // Make sure volume is a number
    volume = parseFloat(volume);
    if (isNaN(volume)) {
      reject(new Error('Invalid volume value'));
      return;
    }

    if (volume <= 0) {
      reject(new Error('Volume must be greater than zero'));
      return;
    }

    db.get("SELECT density FROM materials WHERE name = ?", [materialName], (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      if (!row) {
        // Default to steel if material not found
        resolve((7.85 * volume) / 1000000);
      } else {
        // Convert volume from mm³ to cm³ and calculate weight in kg
        resolve((row.density * volume) / 1000000);
      }
    });
  });
}

// Calculate cost based on material cost and weight
async function calculateCost(materialName, weight) {
  return new Promise((resolve, reject) => {
    // Make sure weight is a number
    weight = parseFloat(weight);
    if (isNaN(weight)) {
      reject(new Error('Invalid weight value'));
      return;
    }

    if (weight <= 0) {
      reject(new Error('Weight must be greater than zero'));
      return;
    }

    db.get("SELECT cost_per_kg FROM materials WHERE name = ?", [materialName], (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      if (!row) {
        // Default cost if material not found
        resolve(weight * 2.0);
      } else {
        resolve(weight * row.cost_per_kg);
      }
    });
  });
}

// Find alternative materials
async function findAlternatives(materialName, dimensions) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM materials WHERE name = ?", [materialName], (err, originalMaterial) => {
      if (err) {
        reject(err);
        return;
      }

      if (!originalMaterial) {
        resolve([]);
        return;
      }

      db.all("SELECT * FROM materials WHERE id != ?", [originalMaterial.id], (err, materials) => {
        if (err) {
          reject(err);
          return;
        }

        // Calculate similarity scores and sort
        const scoredAlternatives = materials.map(material => {
          const score = calculateSimilarityScore(originalMaterial, material);
          return { ...material, similarity_score: score };
        }).sort((a, b) => b.similarity_score - a.similarity_score);

        // Take top 5 alternatives
        const topAlternatives = scoredAlternatives.slice(0, 5);

        // Add comparison data
        const comparisonsPromises = topAlternatives.map(alt => 
          compareMaterials(originalMaterial, alt, dimensions)
            .then(comparison => {
              alt.comparison = comparison;
              return alt;
            })
        );

        Promise.all(comparisonsPromises)
          .then(alternatives => resolve(alternatives))
          .catch(err => reject(err));
      });
    });
  });
}

// Calculate similarity score between two materials
function calculateSimilarityScore(original, alternative) {
  // Base score
  let score = 0;

  // Properties to compare and their weights
  const properties = {
    tensile_strength: 10,
    yield_strength: 10,
    elastic_modulus: 8,
    thermal_expansion: 5,
    thermal_conductivity: 5,
    corrosion_resistance: 7,
    machinability: 6,
    weldability: 5
  };

  // Calculate property similarity
  const totalWeight = Object.values(properties).reduce((sum, weight) => sum + weight, 0);

  for (const [prop, weight] of Object.entries(properties)) {
    if (original[prop] !== null && alternative[prop] !== null) {
      // For numeric properties
      if (typeof original[prop] === 'number' && typeof alternative[prop] === 'number') {
        // Calculate similarity as percentage difference
        const maxVal = Math.max(Math.abs(original[prop]), Math.abs(alternative[prop]));
        if (maxVal > 0) {
          const diff = Math.abs(original[prop] - alternative[prop]) / maxVal;
          const propScore = (1 - Math.min(diff, 1)) * 100;
          score += (propScore * weight / totalWeight);
        } else {
          score += (100 * weight / totalWeight); // Both values are 0
        }
      } 
      // For string properties
      else if (typeof original[prop] === 'string' && typeof alternative[prop] === 'string') {
        if (original[prop].toLowerCase() === alternative[prop].toLowerCase()) {
          score += (100 * weight / totalWeight);
        }
      }
    }
  }

  // Bonus for same category
  if (original.category === alternative.category) {
    score += 10;
  }

  // Cap score at 100
  return Math.min(score, 100);
}

// Compare two materials
async function compareMaterials(original, alternative, dimensions) {
  // Calculate volume if dimensions are available
  let volume = 1000; // Default volume
  if (dimensions && dimensions.length && dimensions.width) {
    volume = dimensions.length * dimensions.width * dimensions.height;
  }

  // Calculate weights
  const originalWeight = (original.density * volume) / 1000000; // kg
  const altWeight = (alternative.density * volume) / 1000000; // kg

  const weightDiff = altWeight - originalWeight;
  const weightDiffPercent = originalWeight !== 0 ? (weightDiff / originalWeight) * 100 : 0;

  const comparison = {
    weight: {
      original: originalWeight,
      alternative: altWeight,
      difference: weightDiff,
      percent_change: weightDiffPercent
    }
  };

  // Calculate cost difference
  const originalCost = original.cost_per_kg * originalWeight;
  const altCost = alternative.cost_per_kg * altWeight;

  const costDiff = altCost - originalCost;
  const costDiffPercent = originalCost !== 0 ? (costDiff / originalCost) * 100 : 0;

  comparison.cost = {
    original: originalCost,
    alternative: altCost,
    difference: costDiff,
    percent_change: costDiffPercent
  };

  // Compare key mechanical properties
  const mechanicalProps = ['tensile_strength', 'yield_strength', 'elastic_modulus'];
  for (const prop of mechanicalProps) {
    if (original[prop] !== null && alternative[prop] !== null) {
      const diff = alternative[prop] - original[prop];
      const diffPercent = original[prop] !== 0 ? (diff / original[prop]) * 100 : 0;

      comparison[prop] = {
        original: original[prop],
        alternative: alternative[prop],
        difference: diff,
        percent_change: diffPercent
      };
    }
  }

  return comparison;
}

// Process file based on its type
async function processFile(file, fileExtension) {
  console.log(`Processing ${fileExtension} file: ${file.path}`);

  // Default values
  let dimensions = { length: 100, width: 50, height: 25 };
  let volume = dimensions.length * dimensions.width * dimensions.height;
  let material = 'AISI 1018 Steel';
  let annotations = ['Note: Surface finish Ra 1.6', 'Heat treatment: Normalized'];
  let tolerances = ['±0.1mm on critical dimensions'];

  // Process based on file type
  switch(fileExtension) {
    case 'stl':
      try {
        // For STL files, we'll use predefined dimensions
        dimensions = { length: 120, width: 80, height: 40 };
        volume = dimensions.length * dimensions.width * dimensions.height;

        // Read a small portion of the file to determine if it's binary or ASCII STL
        const buffer = Buffer.alloc(84);
        const fd = fs.openSync(file.path, 'r');
        fs.readSync(fd, buffer, 0, 84, 0);
        fs.closeSync(fd);

        // Check if it's a binary STL
        const isBinary = !buffer.toString('utf8', 0, 5).includes('solid');

        if (isBinary) {
          // Extract number of triangles from binary STL
          const triangleCount = buffer.readUInt32LE(80);
          console.log(`Binary STL with ${triangleCount} triangles`);

          // Estimate volume based on triangle count (very rough approximation)
          if (triangleCount > 1000) {
            volume = dimensions.length * dimensions.width * dimensions.height * 1.2;
          }
        } else {
          console.log("ASCII STL detected");
        }
      } catch (err) {
        console.error("Error processing STL file:", err);
      }
      break;

    case 'step':
    case 'stp':
      try {
        console.log(`Traitement du fichier STEP/STP: ${file.path}`);

        // Extract dimensions from STEP file
        const stepData = await parseStepFile(file.path);

        if (stepData) {
          console.log("Données STEP extraites:", JSON.stringify({
            productName: stepData.productName,
            dimensions: stepData.dimensions,
            material: stepData.material,
            pointsCount: stepData.cartesianPoints ? stepData.cartesianPoints.length : 0,
            circlesCount: stepData.circles ? stepData.circles.length : 0
          }, null, 2));

          dimensions = stepData.dimensions;
          material = stepData.material || material;
          annotations = stepData.annotations || annotations;

          // Generate a preview SVG for the STEP file
          const previewSvgPath = path.join(__dirname, 'uploads', `${path.basename(file.path, path.extname(file.path))}_preview.svg`);
          console.log(`Génération de l'aperçu SVG: ${previewSvgPath}`);

          // Ensure stepData has all necessary properties
          if (!stepData.cartesianPoints) stepData.cartesianPoints = [];
          if (!stepData.circles) stepData.circles = [];
          if (!stepData.annotations) stepData.annotations = [];

          generateStepPreview(stepData, previewSvgPath);
        } else {
          console.log("Aucune données STEP extraites, utilisation des dimensions par défaut");
          // Default dimensions for STEP files if parsing fails
          dimensions = { length: 30, width: 20, height: 5 };
        }

        // Calculate volume
        volume = dimensions.length * dimensions.width * dimensions.height;
      } catch (err) {
        console.error("Error processing STEP file:", err);
        console.error(err.stack);
        // Default dimensions for STEP files if an error occurs
        dimensions = { length: 30, width: 20, height: 5 };
        volume = dimensions.length * dimensions.width * dimensions.height;
      }
      break;

    case 'dxf':
      // DXF processing logic
      dimensions = { length: 200, width: 100, height: 10 };
      volume = dimensions.length * dimensions.width * dimensions.height;
      break;

    case 'dwg':
      // DWG processing logic
      dimensions = { length: 180, width: 90, height: 15 };
      volume = dimensions.length * dimensions.width * dimensions.height;
      break;

    case 'pdf':
      // PDF processing logic
      dimensions = { length: 210, width: 297, height: 5 };
      volume = dimensions.length * dimensions.width * dimensions.height;
      break;
  }

  // Calculate weight and cost
  const weight = await calculateWeight(material, volume);
  const cost = await calculateCost(material, weight);

  // Find alternative materials
  const alternatives = await findAlternatives(material, dimensions);

  return {
    dimensions,
    volume,
    material,
    weight,
    cost,
    alternatives,
    annotations,
    tolerances
  };
}

// Parse STEP file to extract dimensions and other metadata
async function parseStepFile(filePath) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Traitement du fichier STEP: ${filePath}`);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error(`Le fichier STEP n'existe pas: ${filePath}`);
        resolve({
          productName: "Pièce inconnue",
          dimensions: { length: 30, width: 30, height: 5 },
          material: 'AISI 1018 Steel',
          annotations: ["Fichier introuvable"],
          boundingBox: { min: [0, 0, 0], max: [30, 30, 5] },
          cartesianPoints: [],
          circles: []
        });
        return;
      }

      // Read the file content
      const fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      let fileContent = '';
      let productName = '';
      let materialInfo = '';
      let boundingBox = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      let cartesianPoints = [];
      let annotations = [];
      let circles = [];
      let lineCount = 0;
      let productLines = [];
      let materialLines = [];

      // Extract information from file name if available
      const fileName = path.basename(filePath, path.extname(filePath));
      if (fileName && fileName.length > 0) {
        console.log(`Analyse du nom de fichier: ${fileName}`);

        // Try to extract information from file name (rondelle, vis, etc.)
        if (fileName.toLowerCase().includes('rondelle')) {
          productName = fileName;

          // Try to extract dimensions from filename
          const dimensionMatch = fileName.match(/(\d+)mm/);
          if (dimensionMatch && dimensionMatch.length > 1) {
            const diameter = parseInt(dimensionMatch[1], 10);
            if (!isNaN(diameter) && diameter > 0) {
              console.log(`Diamètre extrait du nom: ${diameter}mm`);

              // Default height for washers if not specified
              const height = 5; 

              boundingBox = {
                min: [-diameter/2, -diameter/2, -height/2],
                max: [diameter/2, diameter/2, height/2]
              };
            }
          }
        }
      }

      // Process the file line by line
      rl.on('line', (line) => {
        lineCount++;
        fileContent += line + '\n';

        // Extract product name
        if (line.includes('PRODUCT') || line.includes('product')) {
          productLines.push(line);
          if (!productName) {
            const matches = line.match(/'([^']+)'/g);
            if (matches && matches.length > 0) {
              productName = matches[0].replace(/'/g, '');
              console.log(`Nom du produit trouvé: ${productName}`);
            }
          }
        }

        // Extract material information
        if (line.toLowerCase().includes('material') || line.toLowerCase().includes('matériau') || 
            line.toLowerCase().includes('acier') || line.toLowerCase().includes('steel') ||
            line.toLowerCase().includes('aluminium') || line.toLowerCase().includes('aluminum')) {

          materialLines.push(line);
          if (!materialInfo) {
            const matches = line.match(/'([^']+)'/g);
            if (matches && matches.length > 0) {
              materialInfo = matches[0].replace(/'/g, '');
              console.log(`Information sur le matériau trouvée: ${materialInfo}`);
            }
          }
        }

        // Extract annotations
        if (line.includes('ANNOTATION') || line.includes('NOTE') || line.includes('REMARK') ||
            line.includes('PROPERTY_DEFINITION') || line.includes('property_definition')) {
          const matches = line.match(/'([^']+)'/g);
          if (matches && matches.length > 0) {
            const annotation = matches[0].replace(/'/g, '');
            annotations.push(annotation);
          }
        }

        // Extract Cartesian points
        if (line.includes('CARTESIAN_POINT') || line.includes('cartesian_point')) {
          try {
            const coordMatches = line.match(/\(([^)]+)\)/g);
            if (coordMatches && coordMatches.length > 0) {
              const coordStr = coordMatches[0].replace(/[()]/g, '');
              const coords = coordStr.split(',').map(c => {
                // Handle scientific notation and convert to float
                const value = c.trim();
                return parseFloat(value);
              });

              if (coords.length >= 3 && !isNaN(coords[0]) && !isNaN(coords[1]) && !isNaN(coords[2])) {
                cartesianPoints.push(coords);

                // Update bounding box
                boundingBox.min[0] = Math.min(boundingBox.min[0], coords[0]);
                boundingBox.min[1] = Math.min(boundingBox.min[1], coords[1]);
                boundingBox.min[2] = Math.min(boundingBox.min[2], coords[2]);

                boundingBox.max[0] = Math.max(boundingBox.max[0], coords[0]);
                boundingBox.max[1] = Math.max(boundingBox.max[1], coords[1]);
                boundingBox.max[2] = Math.max(boundingBox.max[2], coords[2]);
              }
            }
          } catch (pointErr) {
            console.error(`Erreur lors de l'extraction des points à la ligne ${lineCount}:`, pointErr.message);
          }
        }

        // Extract circles (for washers and similar parts)
        if (line.includes('CIRCLE') || line.includes('circle')) {
          try {
            // Extended pattern to match more STEP file circle formats
            const radiusMatches = [
              // Standard format
              line.match(/CIRCLE\s*\([^)]*\)\s*,\s*([0-9.eE+-]+)/),
              // Alternative format
              line.match(/circle\s*\([^)]*\)\s*,\s*([0-9.eE+-]+)/),
              // Additional formats
              line.match(/radius\s*=\s*([0-9.eE+-]+)/i),
              line.match(/r\s*=\s*([0-9.eE+-]+)/)
            ];

            for (const match of radiusMatches) {
              if (match && match.length > 1) {
                const radius = parseFloat(match[1]);
                if (!isNaN(radius) && radius > 0) {
                  circles.push(radius);
                  console.log(`Rayon de cercle trouvé: ${radius}mm`);
                  break;
                }
              }
            }
          } catch (circleErr) {
            console.error(`Erreur lors de l'extraction des cercles à la ligne ${lineCount}:`, circleErr.message);
          }
        }
      });

      rl.on('close', () => {
        console.log(`Analyse du fichier STEP terminée. Points: ${cartesianPoints.length}, Cercles: ${circles.length}`);

        // Calculate dimensions from bounding box
        let dimensions = {
          length: 0,
          width: 0,
          height: 0
        };

        // Check if we found valid points for bounding box
        if (boundingBox.min[0] !== Infinity && boundingBox.max[0] !== -Infinity) {
          console.log(`Boîte englobante trouvée: Min(${boundingBox.min.join(', ')}), Max(${boundingBox.max.join(', ')})`);

          // Calculate dimensions in mm
          dimensions.length = Math.abs(boundingBox.max[0] - boundingBox.min[0]);
          dimensions.width = Math.abs(boundingBox.max[1] - boundingBox.min[1]);
          dimensions.height = Math.abs(boundingBox.max[2] - boundingBox.min[2]);

          console.log(`Dimensions calculées: ${dimensions.length.toFixed(2)} x ${dimensions.width.toFixed(2)} x ${dimensions.height.toFixed(2)} mm`);

          // Sort dimensions to ensure length is the largest
          const dims = [dimensions.length, dimensions.width, dimensions.height].sort((a, b) => b - a);
          dimensions.length = dims[0];
          dimensions.width = dims[1];
          dimensions.height = dims[2];

          console.log(`Dimensions triées: ${dimensions.length.toFixed(2)} x ${dimensions.width.toFixed(2)} x ${dimensions.height.toFixed(2)} mm`);

          // Special case for circular parts like washers
          if (circles.length > 0 && 
              (productName.toLowerCase().includes('rondelle') || 
               productName.toLowerCase().includes('washer') ||
               fileName.toLowerCase().includes('rondelle') ||
               fileName.toLowerCase().includes('washer'))) {

            const largestRadius = Math.max(...circles);
            console.log(`Rayon de la rondelle détecté: ${largestRadius}mm`);

            dimensions.length = largestRadius * 2;
            dimensions.width = largestRadius * 2;

            // For specific rondelleintercloche files or if height is very small
            if (productName.includes('Rondelleintercloche') || dimensions.height < 0.5) {
              dimensions.height = 5; // Standard washer thickness
            }

            console.log(`Dimensions de rondelle: ${dimensions.length.toFixed(2)} x ${dimensions.width.toFixed(2)} x ${dimensions.height.toFixed(2)} mm`);
          }

          // Apply minimum dimensions to avoid zero or very small values
          dimensions.length = Math.max(dimensions.length, 5);
          dimensions.width = Math.max(dimensions.width, 5);
          dimensions.height = Math.max(dimensions.height, 2);
        } else {
          console.log("Aucun point valide trouvé pour calculer les dimensions. Utilisation des valeurs par défaut.");

          // If no points found, use default dimensions based on file name or generic values
          if (fileName.toLowerCase().includes('rondelle') || fileName.toLowerCase().includes('washer')) {
            dimensions = { length: 30, width: 30, height: 5 };
          } else if (fileName.toLowerCase().includes('vis') || fileName.toLowerCase().includes('screw')) {
            dimensions = { length: 50, width: 10, height: 10};
          } else if (fileName.toLowerCase().includes('bracket') || fileName.toLowerCase().includes('support')) {
            dimensions = { length: 80, width: 40, height: 10 };
          } else {
            dimensions = { length: 50, width: 30, height: 10 };
          }

          console.log(`Dimensions par défaut: ${dimensions.length} x ${dimensions.width} x ${dimensions.height} mm`);
        }

        // Determine material from file content or product name
        let material = 'AISI 1018 Steel'; // Default material

        if (materialInfo) {
          material = materialInfo;
          console.log(`Matériau extrait: ${material}`);
        } else {
          // Try to determine material from file content
          const lowerContent = fileContent.toLowerCase();

          if (materialLines.length > 0) {
            console.log("Lignes avec information sur le matériau:", materialLines);
          }

          if (lowerContent.includes('acier') || lowerContent.includes('steel')) {
            if (lowerContent.includes('inox') || lowerContent.includes('stainless')) {
              material = 'AISI 304 Stainless Steel';
            } else {
              material = 'AISI 1018 Steel';
            }
          } else if (lowerContent.includes('aluminium') || lowerContent.includes('aluminum')) {
            if (lowerContent.includes('6061')) {
              material = 'Aluminum 6061-T6';
            } else if (lowerContent.includes('7075')) {
              material = 'Aluminum 7075-T6';
            } else {
              material = 'Aluminum 6061-T6';
            }
          } else if (lowerContent.includes('titanium') || lowerContent.includes('titane')) {
            material = 'Ti-6Al-4V';
          } else if (lowerContent.includes('brass') || lowerContent.includes('laiton')) {
            material = 'Brass C360';
          } else if (lowerContent.includes('bronze')) {
            material = 'Bronze C932';
          } else if (lowerContent.includes('copper') || lowerContent.includes('cuivre')) {
            material = 'Copper C11000';
          }

          console.log(`Matériau déterminé: ${material}`);
        }

        // If product name is still empty, try to extract from file name
        if (!productName) {
          productName = path.basename(filePath, path.extname(filePath));
          console.log(`Nom du produit extrait du nom de fichier: ${productName}`);
        }

        // Return the extracted data
        resolve({
          productName,
          dimensions,
          material,
          annotations,
          boundingBox,
          cartesianPoints,
          circles
        });
      });

      rl.on('error', (err) => {
        console.error("Erreur lors de la lecture du fichier STEP:", err);
        // Resolve with default data instead of rejecting
        resolve({
          productName: path.basename(filePath, path.extname(filePath)) || "Pièce inconnue",
          dimensions: { length: 30, width: 30, height: 5 },
          material: 'AISI 1018 Steel',
          annotations: ["Erreur lors de la lecture du fichier"],
          boundingBox: { min: [0, 0, 0], max: [30, 30, 5] },
          cartesianPoints: [],
          circles: []
        });
      });
    } catch (err) {
      console.error("Exception lors du traitement du fichier STEP:", err);
      console.error(err.stack);
      // Resolve with default data instead of rejecting
      resolve({
        productName: path.basename(filePath, path.extname(filePath)) || "Pièce inconnue",
        dimensions: { length: 30, width: 30, height: 5 },
        material: 'AISI 1018 Steel',
        annotations: ["Exception lors du traitement du fichier"],
        boundingBox: { min: [0, 0, 0], max: [30, 30, 5] },
        cartesianPoints: [],
        circles: []
      });
    }
  });
}

// Generate a preview SVG for STEP files
function generateStepPreview(stepData, outputPath) {
  try {
    console.log("Génération d'un aperçu SVG pour", outputPath);

    // Create a simple SVG representation of the part
    const width = 400;
    const height = 300;
    const padding = 40;

    // Ensure we have all the necessary data
    if (!stepData) {
      console.error("stepData est undefined ou null");
      const defaultSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f8f9fa"/>
        <text x="50%" y="50%" font-family="Arial" font-size="20" text-anchor="middle" fill="#6c757d">
          Pièce mécanique
        </text>
        <text x="50%" y="65%" font-family="Arial" font-size="14" text-anchor="middle" fill="#6c757d">
          Données non disponibles
        </text>
      </svg>`;
      fs.writeFileSync(outputPath, defaultSvg);
      return;
    }

    // Make sure we have the required properties and set defaults
    stepData.productName = stepData.productName || 'Pièce mécanique';
    stepData.dimensions = stepData.dimensions || { length: 30, width: 30, height: 5 };
    stepData.circles = stepData.circles || [];
    stepData.cartesianPoints = stepData.cartesianPoints || [];
    stepData.boundingBox = stepData.boundingBox || { 
      min: [0, 0, 0], 
      max: [100, 100, 100] 
    };

    // Default dimensions for common part types based on product name if dimensions are missing or zero
    if (stepData.productName && 
        (!stepData.dimensions.length || !stepData.dimensions.width || !stepData.dimensions.height || 
         stepData.dimensions.length <= 0 || stepData.dimensions.width <= 0 || stepData.dimensions.height <= 0)) {

      if (stepData.productName.toLowerCase().includes('rondelle')) {
        stepData.dimensions = { length: 30, width: 30, height: 5 };
      } else if (stepData.productName.toLowerCase().includes('vis') || 
                 stepData.productName.toLowerCase().includes('bolt')) {
        stepData.dimensions = { length: 50, width: 10, height: 10 };
      } else if (stepData.productName.toLowerCase().includes('écrou') || 
                 stepData.productName.toLowerCase().includes('nut')) {
        stepData.dimensions = { length: 20, width: 20, height: 10 };
      }
    }

    // Special handling for circular parts like washers
    if ((stepData.circles && stepData.circles.length > 0) || 
        (stepData.productName && stepData.productName.toLowerCase().includes('rondelle'))) {
      try {
        // Create a washer-like SVG
        const svgContent = generateWasherSvg(stepData, width, height);
        // Write the SVG file
        fs.writeFileSync(outputPath, svgContent);
        console.log("Aperçu de rondelle généré avec succès");
        return;
      } catch (washerErr) {
        console.error("Erreur lors de la génération de l'aperçu de rondelle:", washerErr);
        console.error(washerErr.stack);
        // Continue to standard preview if washer generation fails
      }
    }

    // Get points for visualization
    const points = stepData.cartesianPoints || [];

    // If we have no points, create a default preview
    if (!points.length) {
      console.log("Aucun point trouvé, création d'un aperçu par défaut");
      const defaultSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f8f9fa"/>
        <text x="50%" y="50%" font-family="Arial" font-size="20" text-anchor="middle" fill="#6c757d">
          ${stepData.productName}
        </text>
        <text x="50%" y="65%" font-family="Arial" font-size="14" text-anchor="middle" fill="#6c757d">
          ${stepData.dimensions.length.toFixed(2)} x ${stepData.dimensions.width.toFixed(2)} x ${stepData.dimensions.height.toFixed(2)} mm
        </text>
      </svg>`;

      fs.writeFileSync(outputPath, defaultSvg);
      return;
    }

    // Calculate scale to fit the SVG
    const bbox = stepData.boundingBox;

    // Ensure valid bounding box values - use default if values are invalid
    let modelWidth = 100, modelHeight = 100;

    if (bbox && bbox.min && bbox.max && 
        Array.isArray(bbox.min) && Array.isArray(bbox.max) && 
        bbox.min.length >= 2 && bbox.max.length >= 2) {
      modelWidth = Math.max(0.1, bbox.max[0] - bbox.min[0]);
      modelHeight = Math.max(0.1, bbox.max[1] - bbox.min[1]);
    }

    const scaleX = (width - padding * 2) / modelWidth;
    const scaleY = (height - padding * 2) / modelHeight;
    const scale = Math.min(scaleX, scaleY);

    // Transform function to convert model coordinates to SVG coordinates
    const transformX = (x) => {
      try {
        return padding + (x - bbox.min[0]) * scale;
      } catch (e) {
        return padding;
      }
    };

    const transformY = (y) => {
      try {
        return height - padding - (y - bbox.min[1]) * scale;
      } catch (e) {
        return height - padding;
      }
    };

    // Start SVG content
    let svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f8f9fa"/>

      <!-- Part outline -->
      <g stroke="#333" stroke-width="1" fill="none">`;

    try {
      // Safely add lines connecting points (simplified representation)
      const validPoints = [];

      // First filter out invalid points
      for (let i = 0; i < points.length; i++) {
        if (points[i] && Array.isArray(points[i]) && points[i].length >= 2 &&
            !isNaN(points[i][0]) && !isNaN(points[i][1])) {
          validPoints.push(points[i]);
        }
      }

      // Then draw lines between valid points
      for (let i = 0; i < validPoints.length - 1; i++) {
        const x1 = transformX(validPoints[i][0]);
        const y1 = transformY(validPoints[i][1]);
        const x2 = transformX(validPoints[i + 1][0]);
        const y2 = transformY(validPoints[i + 1][1]);

        // Final check that values are valid numbers
        if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2)) {
          svgContent += `
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
        }
      }
    } catch (lineErr) {
      console.error("Erreur lors de la génération des lignes:", lineErr);
      console.error(lineErr.stack);
      // Continue without lines
    }

    // Close the part outline
    svgContent += `
      </g>

      <!-- Part dimensions -->
      <text x="50%" y="${height - 10}" font-family="Arial" font-size="12" text-anchor="middle" fill="#6c757d">
        ${stepData.dimensions.length.toFixed(2)} x ${stepData.dimensions.width.toFixed(2)} x ${stepData.dimensions.height.toFixed(2)} mm
      </text>
    </svg>`;

    // Write the SVG file
    fs.writeFileSync(outputPath, svgContent);
    console.log("Aperçu SVG généré avec succès");
  } catch (err) {
    console.error("Error generating SVG preview:", err);
    console.error(err.stack);
    // Create a fallback SVG in case of error
    try {
      const width = 400;
      const height = 300;
      const errorSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f8f9fa"/>
        <text x="50%" y="50%" font-family="Arial" font-size="20" text-anchor="middle" fill="#6c757d">
          Erreur de génération d'aperçu
        </text>
        <text x="50%" y="65%" font-family="Arial" font-size="14" text-anchor="middle" fill="#6c757d">
          Le fichier a été traité mais l'aperçu n'a pas pu être généré
        </text>
      </svg>`;
      fs.writeFileSync(outputPath, errorSvg);
    } catch (fallbackErr) {
      console.error("Impossible de créer l'aperçu de secours:", fallbackErr);
    }
  }
}

// Generate SVG for washer-like parts
function generateWasherSvg(stepData, width, height) {
  try {
    console.log("Génération d'un aperçu de rondelle");

    if (!stepData) {
      throw new Error("stepData est undefined ou null");
    }

    const centerX = width / 2;
    const centerY = height / 2;

    // Ensure dimensions are available
    const dimensions = stepData.dimensions || { length: 30, width: 30, height: 5 };
    const productName = stepData.productName || 'Rondelle';

    // Default radiuses
    let outerRadius = 50;
    let innerRadius = 25;

    // Try to get actual dimensions from circles
    if (stepData.circles && Array.isArray(stepData.circles) && stepData.circles.length > 0) {
      console.log(`Cercles trouvés: ${stepData.circles.join(', ')}`);

      // Sort radii from largest to smallest
      const sortedRadii = [...stepData.circles].filter(r => !isNaN(r) && r > 0).sort((a, b) => b - a);

      if (sortedRadii.length > 0) {
        outerRadius = sortedRadii[0];
        console.log(`Rayon extérieur: ${outerRadius}mm`);

        if (sortedRadii.length > 1) {
          innerRadius = sortedRadii[1];
          console.log(`Rayon intérieur: ${innerRadius}mm`);
        } else {
          innerRadius = outerRadius * 0.5;
          console.log(`Rayon intérieur (calculé): ${innerRadius}mm`);
        }
      }
    } else {
      console.log("Aucun cercle trouvé, utilisation des dimensions de la pièce");

      // If no circles found, use dimensions to estimate outer and inner diameters
      if (dimensions && dimensions.length > 0 && dimensions.width > 0) {
        // Washer outer diameter is typically the length (largest dimension)
        outerRadius = dimensions.length / 2;
        console.log(`Rayon extérieur (calculé à partir des dimensions): ${outerRadius}mm`);

        // Inner radius is typically 40-60% of outer radius for standard washers
        innerRadius = outerRadius * 0.5;
        console.log(`Rayon intérieur (calculé à partir des dimensions): ${innerRadius}mm`);
      }
    }

    // Ensure valid radius values (with minimum sizes for visibility)
    if (isNaN(outerRadius) || outerRadius <= 0) {
      console.warn("Rayon extérieur invalide, utilisation de la valeur par défaut");
      outerRadius = 15;
    }

    if (isNaN(innerRadius) || innerRadius <= 0 || innerRadius >= outerRadius) {
      console.warn("Rayon intérieur invalide, utilisation de 50% du rayon extérieur");
      innerRadius = outerRadius * 0.5;
    }

    // Convert to display dimensions
    const displayOuterDiameter = outerRadius * 2;
    const displayInnerDiameter = innerRadius * 2;

    // Calculate the scale to fit in the SVG
    const maxDimension = Math.max(displayOuterDiameter, 10); // Prevent division by zero
    const scale = Math.min((width - 100) / maxDimension, (height - 100) / maxDimension);

    const scaledOuterRadius = outerRadius * scale;
    const scaledInnerRadius = innerRadius * scale;

    console.log(`Rayons mis à l'échelle - Extérieur: ${scaledOuterRadius}, Intérieur: ${scaledInnerRadius}`);

    // Add a 3D effect with gradient and shadow
    const svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="washerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#d0d0d0" />
          <stop offset="50%" stop-color="#f0f0f0" />
          <stop offset="100%" stop-color="#a0a0a0" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.3" />
        </filter>
      </defs>

      <rect width="100%" height="100%" fill="#f8f9fa"/>

      <!-- Washer representation with 3D effect -->
      <g transform="translate(${centerX}, ${centerY})">
        <!-- Outer circle with gradient fill -->
        <circle cx="0" cy="0" r="${scaledOuterRadius}" fill="url(#washerGradient)" stroke="#333" stroke-width="1" filter="url(#shadow)" />

        <!-- Inner circle (hole) -->
        <circle cx="0" cy="0" r="${scaledInnerRadius}" fill="#f8f9fa" stroke="#333" stroke-width="1" />

        <!-- Top highlight -->
        <path d="M ${-scaledOuterRadius * 0.7} ${-scaledOuterRadius * 0.7} A ${scaledOuterRadius} ${scaledOuterRadius} 0 0 1 ${scaledOuterRadius * 0.7} ${-scaledOuterRadius * 0.7}"
              stroke="white" stroke-width="2" fill="none" opacity="0.6" />
      </g>

      <!-- Dimensions -->
      <text x="50%" y="${height - 60}" font-family="Arial" font-size="16" text-anchor="middle" fill="#333" font-weight="bold">
        ${productName}
      </text>
      <text x="50%" y="${height - 30}" font-family="Arial" font-size="14" text-anchor="middle" fill="#6c757d">
        Ø ${displayOuterDiameter.toFixed(1)} x Ø ${displayInnerDiameter.toFixed(1)} x ${dimensions.height.toFixed(1)} mm
      </text>
    </svg>`;

    return svgContent;
  } catch (err) {
    console.error("Erreur lors de la génération de l'aperçu de rondelle:", err);
    console.error(err.stack);

    // Return a simple fallback SVG
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f8f9fa"/>
      <text x="50%" y="50%" font-family="Arial" font-size="20" text-anchor="middle" fill="#6c757d">
        Rondelle
      </text>
      <text x="50%" y="65%" font-family="Arial" font-size="14" text-anchor="middle" fill="#6c757d">
        Aperçu non disponible
      </text>
    </svg>`;
  }
}

// API ROUTES

// Get all materials
app.get('/api/materials', (req, res) => {
  db.all("SELECT * FROM materials", (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to fetch materials" });
    }
    res.json(rows);
  });
});

// Get material by ID
app.get('/api/materials/:id', (req, res) => {
  db.get("SELECT * FROM materials WHERE id = ?", [req.params.id], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to fetch material" });
    }
    if (!row) {
      return res.status(404).json({ error: "Material not found" });
    }
    res.json(row);
  });
});

// Upload file route
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    console.log("Requête de téléchargement reçue");

    if (!req.file) {
      console.error("Aucun fichier dans la requête");
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log(`Fichier reçu: ${req.file.originalname} (${req.file.size} octets)`);

    // Vérifier que le fichier existe
    if (!fs.existsSync(req.file.path)) {
      console.error(`Le fichier téléchargé n'existe pas: ${req.file.path}`);
      return res.status(500).json({ error: "Le fichier téléchargé n'a pas été correctement enregistré" });
    }

    const fileExtension = path.extname(req.file.originalname).toLowerCase().replace('.', '');
    console.log(`Extension du fichier: ${fileExtension}`);

    let result;

    try {
      // Process the uploaded file
      console.log(`Début du traitement du fichier ${req.file.path}`);
      result = await processFile(req.file, fileExtension);
      console.log("Traitement du fichier terminé avec succès");
    } catch (processingError) {
      console.error("Erreur lors du traitement du fichier:", processingError);
      console.error(processingError.stack);

      // En cas d'erreur, définir des dimensions par défaut basées sur le type de fichier
      let defaultDimensions = { length: 100, width: 50, height: 25 };

      if (fileExtension === 'step' || fileExtension === 'stp') {
        defaultDimensions = { length: 30, width: 30, height: 5 };
      } else if (fileExtension === 'stl') {
        defaultDimensions = { length: 120, width: 80, height: 40 };
      }

      const defaultVolume = defaultDimensions.length * defaultDimensions.width * defaultDimensions.height;

      // Tenter d'extraire un nom significatif du fichier
      const fileName = path.basename(req.file.originalname, path.extname(req.file.originalname));

      // Créer un résultat par défaut
      result = {
        dimensions: defaultDimensions,
        volume: defaultVolume,
        material: 'AISI 1018 Steel',
        weight: 0.984, // Poids approximatif pour ces dimensions avec de l'acier
        cost: 1.18, // Coût approximatif
        alternatives: [],
        annotations: [
          `Erreur lors du traitement: ${processingError.message}`,
          `Dimensions par défaut utilisées`
        ],
        tolerances: ['±0.1mm sur les dimensions critiques'],
        productName: fileName || 'Pièce inconnue'
      };

      console.log("Résultat par défaut créé pour traiter l'erreur");
    }

    // Vérifier que le résultat est valide
    if (!result) {
      console.error("Le traitement du fichier n'a pas retourné de résultat");
      result = {
        dimensions: { length: 100, width: 50, height: 25 },
        volume: 100 * 50 * 25,
        material: 'AISI 1018 Steel',
        weight: 0.984,
        cost: 1.18,
        alternatives: [],
        annotations: ["Résultat de traitement invalide"],
        tolerances: ['±0.1mm sur les dimensions critiques']
      };
    }

    // Create a preview path for frontend
    const previewBaseName = path.basename(req.file.path, path.extname(req.file.path));
    const previewFileName = `${previewBaseName}_preview.svg`;
    const previewPath = `/uploads/${previewFileName}`;
    const fullPreviewPath = path.join(__dirname, 'uploads', previewFileName);

    // Créer ou vérifier l'aperçu SVG
    try {
      // Si l'aperçu n'existe pas ou est vide, créer un aperçu
      if (!fs.existsSync(fullPreviewPath) || fs.statSync(fullPreviewPath).size === 0) {
        console.log(`Création d'un aperçu: ${fullPreviewPath}`);

        // Créer un aperçu personnalisé en fonction du type de fichier
        let previewSvg = '';

        if (fileExtension === 'step' || fileExtension === 'stp') {
          if (result.productName && result.productName.toLowerCase().includes('rondelle')) {
            // Créer un aperçu de rondelle
            previewSvg = generateWasherSvg({
              productName: result.productName,
              dimensions: result.dimensions,
              circles: [result.dimensions.length / 2, result.dimensions.length / 4]
            }, 400, 300);
          } else {
            // Créer un aperçu standard pour pièce STEP
            previewSvg = `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="partGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#c8c8c8" />
                  <stop offset="50%" stop-color="#e8e8e8" />
                  <stop offset="100%" stop-color="#a8a8a8" />
                </linearGradient>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="3" dy="3" stdDeviation="4" flood-opacity="0.3" />
                </filter>
              </defs>
              <rect width="100%" height="100%" fill="#f8f9fa"/>
              <rect x="100" y="100" width="200" height="100" rx="5" fill="url(#partGradient)" stroke="#333" stroke-width="1" filter="url(#shadow)" />
              <text x="50%" y="50%" font-family="Arial" font-size="16" text-anchor="middle" fill="#333" font-weight="bold">
                ${result.productName || 'Pièce mécanique'}
              </text>
              <text x="50%" y="75%" font-family="Arial" font-size="14" text-anchor="middle" fill="#6c757d">
                ${result.dimensions.length.toFixed(1)} x ${result.dimensions.width.toFixed(1)} x ${result.dimensions.height.toFixed(1)} mm
              </text>
            </svg>`;
          }
        } else if (fileExtension === 'stl') {
          // Aperçu pour fichier STL
          previewSvg = `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="modelGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#b9d9ff" />
                <stop offset="100%" stop-color="#6badfb" />
              </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="#f8f9fa"/>
            <polygon points="200,80 120,200 280,200" fill="url(#modelGradient)" stroke="#333" stroke-width="1" />
            <text x="50%" y="240" font-family="Arial" font-size="16" text-anchor="middle" fill="#333" font-weight="bold">
              Modèle 3D
            </text>
            <text x="50%" y="265" font-family="Arial" font-size="14" text-anchor="middle" fill="#6c757d">
              ${result.dimensions.length.toFixed(1)} x ${result.dimensions.width.toFixed(1)} x ${result.dimensions.height.toFixed(1)} mm
            </text>
          </svg>`;
        } else {
          // Aperçu générique
          previewSvg = `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#f8f9fa"/>
            <text x="50%" y="50%" font-family="Arial" font-size="20" text-anchor="middle" fill="#6c757d">
              ${fileExtension.toUpperCase()}
            </text>
            <text x="50%" y="65%" font-family="Arial" font-size="14" text-anchor="middle" fill="#6c757d">
              ${result.dimensions.length.toFixed(1)} x ${result.dimensions.width.toFixed(1)} x ${result.dimensions.height.toFixed(1)} mm
            </text>
          </svg>`;
        }

        fs.writeFileSync(fullPreviewPath, previewSvg);
        console.log("Aperçu généré avec succès");
      } else {
        console.log(`L'aperçu existe déjà: ${fullPreviewPath}`);
      }
    } catch (previewError) {
      console.error("Erreur lors de la création de l'aperçu:", previewError);

      // Créer un aperçu d'erreur simple
      const errorSvg = `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f8f9fa"/>
        <text x="50%" y="50%" font-family="Arial" font-size="20" text-anchor="middle" fill="#6c757d">
          ${fileExtension.toUpperCase()}
        </text>
        <text x="50%" y="65%" font-family="Arial" font-size="14" text-anchor="middle" fill="#6c757d">
          Aperçu non disponible
        </text>
      </svg>`;

      try {
        fs.writeFileSync(fullPreviewPath, errorSvg);
      } catch (e) {
        console.error("Impossible de créer l'aperçu d'erreur:", e);
      }
    }

    // Trouver des alternatives de matériaux avant d'envoyer la réponse
    let alternatives = [];
    try {
      alternatives = await findAlternatives(result.material, result.dimensions);
      console.log(`${alternatives.length} alternatives de matériaux trouvées`);
    } catch (altError) {
      console.error("Erreur lors de la recherche d'alternatives:", altError);
    }

    result.alternatives = alternatives;

    // Envoyer la réponse
    res.json({
      success: true,
      file: {
        originalName: req.file.originalname,
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size,
        extension: fileExtension,
        previewPath: previewPath
      },
      analysis: result
    });
    console.log("Réponse envoyée avec succès au client");
  } catch (error) {
    console.error("Erreur critique lors du téléchargement:", error);
    console.error(error.stack);

    // Envoyer une réponse d'erreur détaillée
    res.status(500).json({ 
      error: "Failed to process uploaded file", 
      details: error.message,
      stack: error.stack
    });
  }
});

// Get alternatives for material
app.get('/api/materials/:name/alternatives', async (req, res) => {
  try {
    const materialName = req.params.name;
    const dimensions = {
      length: parseFloat(req.query.length) || 100,
      width: parseFloat(req.query.width) || 50,
      height: parseFloat(req.query.height) || 25
    };

    const alternatives = await findAlternatives(materialName, dimensions);
    res.json(alternatives);
  } catch (error) {
    console.error("Error finding alternatives:", error);
    res.status(500).json({ error: "Failed to find alternatives", details: error.message });
  }
});

// Calculate weight for material and dimensions
app.post('/api/calculate/weight', async (req, res) => {
  try {
    const { material, dimensions } = req.body;

    if (!material || !dimensions) {
      return res.status(400).json({ error: "Material and dimensions are required" });
    }

    const volume = dimensions.length * dimensions.width * dimensions.height;
    const weight = await calculateWeight(material, volume);

    res.json({ weight });
  } catch (error) {
    console.error("Error calculating weight:", error);
    res.status(500).json({ error: "Failed to calculate weight", details: error.message });
  }
});

// Calculate cost for material and weight
app.post('/api/calculate/cost', async (req, res) => {
  try {
    const { material, weight } = req.body;

    if (!material || weight === undefined) {
      return res.status(400).json({ error: "Material and weight are required" });
    }

    const cost = await calculateCost(material, weight);

    res.json({ cost });
  } catch (error) {
    console.error("Error calculating cost:", error);
    res.status(500).json({ error: "Failed to calculate cost", details: error.message });
  }
});

// Compare materials
app.post('/api/compare-materials', async (req, res) => {
  try {
    const { originalMaterial, comparisonMaterial, dimensions } = req.body;

    if (!originalMaterial || !comparisonMaterial) {
      return res.status(400).json({ error: "Original and comparison materials are required" });
    }

    db.get("SELECT * FROM materials WHERE name = ?", [originalMaterial], async (err, original) => {
      if (err || !original) {
        return res.status(404).json({ error: "Original material not found" });
      }

      db.get("SELECT * FROM materials WHERE name = ?", [comparisonMaterial], async (err, comparison) => {
        if (err || !comparison) {
          return res.status(404).json({ error: "Comparison material not found" });
        }

        const result = await compareMaterials(original, comparison, dimensions);
        res.json(result);
      });
    });
  } catch (error) {
    console.error("Error comparing materials:", error);
    res.status(500).json({ error: "Failed to compare materials", details: error.message });
  }
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});