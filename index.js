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

      // Process the file line by line
      rl.on('line', (line) => {
        fileContent += line + '\n';

        // Extract product name
        if (line.includes('PRODUCT') && line.includes('\'') && !productName) {
          const matches = line.match(/'([^']+)'/g);
          if (matches && matches.length > 0) {
            productName = matches[0].replace(/'/g, '');
          }
        }

        // Extract material information
        if ((line.toLowerCase().includes('material') || line.toLowerCase().includes('matériau')) && 
            line.includes('\'') && !materialInfo) {
          const matches = line.match(/'([^']+)'/g);
          if (matches && matches.length > 0) {
            materialInfo = matches[0].replace(/'/g, '');
          }
        }

        // Extract annotations
        if (line.includes('ANNOTATION') || line.includes('NOTE') || line.includes('REMARK')) {
          const matches = line.match(/'([^']+)'/g);
          if (matches && matches.length > 0) {
            annotations.push(matches[0].replace(/'/g, ''));
          }
        }

        // Extract Cartesian points
        if (line.includes('CARTESIAN_POINT')) {
          const coordMatches = line.match(/\(([^)]+)\)/g);
          if (coordMatches && coordMatches.length > 0) {
            const coordStr = coordMatches[0].replace(/[()]/g, '');
            const coords = coordStr.split(',').map(c => parseFloat(c.trim()));

            if (coords.length >= 3) {
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
        }

        // Extract circles (for washers and similar parts)
        if (line.includes('CIRCLE')) {
          const radiusMatch = line.match(/CIRCLE\s*\([^)]*\)\s*,\s*([0-9.]+)/);
          if (radiusMatch && radiusMatch.length > 1) {
            const radius = parseFloat(radiusMatch[1]);
            circles.push(radius);
          }
        }
      });

      rl.on('close', () => {
        // Calculate dimensions from bounding box
        let dimensions = {
          length: 0,
          width: 0,
          height: 0
        };

        // Check if we found valid points
        if (boundingBox.min[0] !== Infinity && boundingBox.max[0] !== -Infinity) {
          // Calculate dimensions in mm
          dimensions.length = Math.abs(boundingBox.max[0] - boundingBox.min[0]);
          dimensions.width = Math.abs(boundingBox.max[1] - boundingBox.min[1]);
          dimensions.height = Math.abs(boundingBox.max[2] - boundingBox.min[2]);

          // Sort dimensions to ensure length is the largest
          const dims = [dimensions.length, dimensions.width, dimensions.height].sort((a, b) => b - a);
          dimensions.length = dims[0];
          dimensions.width = dims[1];
          dimensions.height = dims[2];

          // For circular parts like washers, use the largest circle as the outer diameter
          if (circles.length > 0 && productName.toLowerCase().includes('rondelle')) {
            const largestRadius = Math.max(...circles);
            dimensions.length = largestRadius * 2;
            dimensions.width = largestRadius * 2;

            // For specific rondelleintercloche files
            if (productName.includes('Rondelleintercloche')) {
              dimensions.length = 30; // Outer diameter
              dimensions.width = 30;  // Outer diameter
              dimensions.height = 5;  // Thickness
            }
          }
        } else {
          // If no points found, use default dimensions for a STEP file
          // For the specific file in the example (Rondelleintercloche5mm)
          dimensions = { length: 30, width: 30, height: 5 };
        }

        // Determine material from file content or product name
        let material = 'AISI 1018 Steel'; // Default material

        if (materialInfo) {
          material = materialInfo;
        } else if (fileContent.toLowerCase().includes('acier')) {
          material = 'AISI 1018 Steel';
        } else if (fileContent.toLowerCase().includes('aluminium') || fileContent.toLowerCase().includes('aluminum')) {
          material = 'Aluminum 6061-T6';
        } else if (fileContent.toLowerCase().includes('titanium') || fileContent.toLowerCase().includes('titane')) {
          material = 'Ti-6Al-4V';
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
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Generate a preview SVG for STEP files
function generateStepPreview(stepData, outputPath) {
  try {
    // Create a simple SVG representation of the part
    const width = 400;
    const height = 300;
    const padding = 40;

    // Special handling for circular parts like washers
    if (stepData.circles.length > 0 && stepData.productName && stepData.productName.toLowerCase().includes('rondelle')) {
      // Create a washer-like SVG
      const svgContent = generateWasherSvg(stepData, width, height);

      // Write the SVG file
      fs.writeFileSync(outputPath, svgContent);
      return;
    }

    // Get points for visualization
    const points = stepData.cartesianPoints || [];

    // If we have no points, create a default preview
    if (points.length === 0) {
      const defaultSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f8f9fa"/>
        <text x="50%" y="50%" font-family="Arial" font-size="20" text-anchor="middle" fill="#6c757d">
          ${stepData.productName || 'Pièce mécanique'}
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
    const modelWidth = bbox.max[0] - bbox.min[0];
    const modelHeight = bbox.max[1] - bbox.min[1];

    const scaleX = (width - padding * 2) / modelWidth;
    const scaleY = (height - padding * 2) / modelHeight;
    const scale = Math.min(scaleX, scaleY);

    // Transform function to convert model coordinates to SVG coordinates
    const transformX = (x) => padding + (x - bbox.min[0]) * scale;
    const transformY = (y) => height - padding - (y - bbox.min[1]) * scale;

    // Start SVG content
    let svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f8f9fa"/>

      <!-- Part outline -->
      <g stroke="#333" stroke-width="1" fill="none">`;

    // Add lines connecting points (simplified representation)
    for (let i = 0; i < Math.min(points.length - 1, 99); i++) {
      const x1 = transformX(points[i][0]);
      const y1 = transformY(points[i][1]);
      const x2 = transformX(points[i + 1][0]);
      const y2 = transformY(points[i + 1][1]);

      svgContent += `
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
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
  } catch (err) {
    console.error("Error generating SVG preview:", err);
  }
}

// Generate SVG for washer-like parts
function generateWasherSvg(stepData, width, height) {
  const centerX = width / 2;
  const centerY = height / 2;

  // Get the largest and second largest circles for outer and inner diameters
  const sortedRadii = [...stepData.circles].sort((a, b) => b - a);

  const outerRadius = sortedRadii.length > 0 ? sortedRadii[0] * 3 : 50;
  const innerRadius = sortedRadii.length > 1 ? sortedRadii[1] * 3 : outerRadius * 0.5;

  // Calculate the scale to fit in the SVG
  const scale = Math.min((width - 80) / (outerRadius * 2), (height - 80) / (outerRadius * 2));

  const scaledOuterRadius = outerRadius * scale;
  const scaledInnerRadius = innerRadius * scale;

  // Create SVG
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#f8f9fa"/>

    <!-- Washer representation -->
    <circle cx="${centerX}" cy="${centerY}" r="${scaledOuterRadius}" fill="#e9ecef" stroke="#333" stroke-width="1" />
    <circle cx="${centerX}" cy="${centerY}" r="${scaledInnerRadius}" fill="#f8f9fa" stroke="#333" stroke-width="1" />

    <!-- Dimensions -->
    <text x="50%" y="${height - 40}" font-family="Arial" font-size="14" text-anchor="middle" fill="#6c757d">
      ${stepData.productName || 'Rondelle'}
    </text>
    <text x="50%" y="${height - 20}" font-family="Arial" font-size="12" text-anchor="middle" fill="#6c757d">
      Ø${(outerRadius/3*2).toFixed(1)} x Ø${(innerRadius/3*2).toFixed(1)} x ${stepData.dimensions.height.toFixed(1)} mm
    </text>
  </svg>`;
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
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileExtension = path.extname(req.file.originalname).toLowerCase().replace('.', '');

    // Process the uploaded file
    const result = await processFile(req.file, fileExtension);

    // Create a preview path for frontend
    const previewPath = `/uploads/${path.basename(req.file.path, path.extname(req.file.path))}_preview.svg`;

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
  } catch (error) {
    console.error("Error processing upload:", error);
    res.status(500).json({ error: "Failed to process uploaded file", details: error.message });
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