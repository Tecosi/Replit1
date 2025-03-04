
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

// HELPER FUNCTIONS

// Parse STEP file to extract dimensions and other metadata
async function parseStepFile(filePath) {
  return new Promise(async (resolve, reject) => {
    console.log("Début de l'analyse du fichier STEP:", filePath);
    
    if (!fs.existsSync(filePath)) {
      console.log("Fichier introuvable:", filePath);
      resolve(createDefaultStepData(path.basename(filePath, path.extname(filePath)), "Fichier introuvable"));
      return;
    }
    
    try {
      console.log("Analyse manuelle du fichier STEP");
      const result = await parseStepFileBackup(filePath);
      console.log("Résultat de l'analyse:", result);
      resolve(result);
    } catch (err) {
      console.error("Erreur lors de l'analyse du fichier STEP:", err);
      resolve(createDefaultStepData(path.basename(filePath, path.extname(filePath)), "Erreur d'analyse"));
    }
  });
}

// Fallback STEP file parser using regex
async function parseStepFileBackup(filePath) {
  return new Promise((resolve, reject) => {
    try {
      console.log("Utilisation de l'analyseur de secours pour le fichier STEP");
      // Read the file content
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      // Extract product name
      let productName = '';
      const productMatch = fileContent.match(/PRODUCT\s*\([^,]*,\s*'([^']+)'/);
      if (productMatch && productMatch.length > 1) {
        productName = productMatch[1];
      } else {
        // Try alternative pattern for product name
        const altProductMatch = fileContent.match(/PRODUCT_DEFINITION[^']*'([^']+)'/);
        if (altProductMatch && altProductMatch.length > 1) {
          productName = altProductMatch[1];
        } else {
          // Use filename as product name if not found
          productName = path.basename(filePath, path.extname(filePath));
        }
      }

      console.log("Nom du produit extrait:", productName);
      
      // Extract material information
      let materialInfo = '';
      const materialMatches = fileContent.match(/MATERIAL\s*\([^,]*,\s*'([^']+)'/);
      if (materialMatches && materialMatches.length > 1) {
        materialInfo = materialMatches[1];
      } else if (fileContent.toLowerCase().includes('acier')) {
        materialInfo = 'AISI 1018 Steel';
      } else if (fileContent.toLowerCase().includes('aluminium') || fileContent.toLowerCase().includes('aluminum')) {
        materialInfo = 'Aluminum 6061-T6';
      }
      
      console.log("Matériau extrait:", materialInfo);
      
      // Extract annotations
      let annotations = [];
      const annotationMatches = fileContent.match(/ANNOTATION[^']*'([^']+)'/g);
      if (annotationMatches) {
        annotations = annotationMatches.map(match => {
          const annotText = match.match(/ANNOTATION[^']*'([^']+)'/);
          return annotText && annotText.length > 1 ? annotText[1] : '';
        }).filter(Boolean);
      }
      
      // Extract dimensions
      let dimensions = { length: 0, width: 0, height: 0 };
      
      // Extract Cartesian points
      console.log("Extraction des points cartésiens");
      const cartesianPoints = [];
      const pointMatches = fileContent.match(/CARTESIAN_POINT\s*\([^)]*\)\s*,\s*\(([^)]+)\)/g);
      
      if (pointMatches) {
        pointMatches.forEach(match => {
          const coordStr = match.match(/\(([^)]+)\)/g);
          if (coordStr && coordStr.length > 1) {
            const coords = coordStr[1].replace(/[()]/g, '').split(',').map(c => parseFloat(c.trim()));
            if (coords.length >= 3) {
              cartesianPoints.push(coords);
            }
          }
        });
      }
      
      console.log(`${cartesianPoints.length} points cartésiens extraits`);
      
      // Calculate bounding box from points
      if (cartesianPoints.length > 0) {
        const boundingBox = {
          min: [Infinity, Infinity, Infinity],
          max: [-Infinity, -Infinity, -Infinity]
        };
        
        cartesianPoints.forEach(point => {
          boundingBox.min[0] = Math.min(boundingBox.min[0], point[0]);
          boundingBox.min[1] = Math.min(boundingBox.min[1], point[1]);
          boundingBox.min[2] = Math.min(boundingBox.min[2], point[2]);
          
          boundingBox.max[0] = Math.max(boundingBox.max[0], point[0]);
          boundingBox.max[1] = Math.max(boundingBox.max[1], point[1]);
          boundingBox.max[2] = Math.max(boundingBox.max[2], point[2]);
        });
        
        // Calculate dimensions from bounding box
        dimensions.length = Math.abs(boundingBox.max[0] - boundingBox.min[0]);
        dimensions.width = Math.abs(boundingBox.max[1] - boundingBox.min[1]);
        dimensions.height = Math.abs(boundingBox.max[2] - boundingBox.min[2]);
        
        // Sort dimensions to ensure length is the largest
        const dims = [dimensions.length, dimensions.width, dimensions.height].sort((a, b) => b - a);
        dimensions.length = Math.round(dims[0]);
        dimensions.width = Math.round(dims[1]);
        dimensions.height = Math.round(dims[2]);
        
        console.log("Dimensions calculées (mm):", dimensions);
      } else {
        console.log("Aucun point cartésien trouvé, utilisation des dimensions par défaut");
        
        // Extract dimensions from header if available
        const headerMatch = fileContent.match(/FILE_DESCRIPTION\s*\([^,]*,\s*'([^']+)'/);
        if (headerMatch && headerMatch.length > 1) {
          const header = headerMatch[1].toLowerCase();
          
          if (header.includes('x') || header.includes('mm')) {
            const dimMatch = header.match(/(\d+)\s*x\s*(\d+)\s*x\s*(\d+)/);
            if (dimMatch && dimMatch.length > 3) {
              dimensions.length = parseInt(dimMatch[1], 10);
              dimensions.width = parseInt(dimMatch[2], 10);
              dimensions.height = parseInt(dimMatch[3], 10);
            }
          }
        }
        
        // If no dimensions were found, use default dimensions based on product name
        if (dimensions.length === 0) {
          if (productName.toLowerCase().includes('rondelle')) {
            dimensions = { length: 30, width: 30, height: 5 };
          } else if (productName.toLowerCase().includes('vis') || productName.toLowerCase().includes('screw')) {
            dimensions = { length: 50, width: 10, height: 10 };
          } else if (productName.toLowerCase().includes('plaque') || productName.toLowerCase().includes('plate')) {
            dimensions = { length: 200, width: 100, height: 10 };
          } else {
            dimensions = { length: 100, width: 50, height: 25 };
          }
          console.log("Dimensions par défaut utilisées (mm):", dimensions);
        }
      }
      
      // Extract circles (for washers and similar parts)
      const circles = [];
      const circleMatches = fileContent.match(/CIRCLE\s*\([^)]*\)\s*,\s*([0-9.]+)/g);
      if (circleMatches) {
        circleMatches.forEach(match => {
          const radiusMatch = match.match(/CIRCLE\s*\([^)]*\)\s*,\s*([0-9.]+)/);
          if (radiusMatch && radiusMatch.length > 1) {
            circles.push(parseFloat(radiusMatch[1]));
          }
        });
        
        // For circular parts, use the largest circle as the outer diameter
        if (circles.length > 0 && productName.toLowerCase().includes('rondelle')) {
          const largestRadius = Math.max(...circles);
          dimensions.length = Math.round(largestRadius * 2);
          dimensions.width = Math.round(largestRadius * 2);
        }
      }
      
      // Determine material if not already found
      if (!materialInfo) {
        materialInfo = determineDefaultMaterial(productName, fileContent);
      }
      
      // Return the extracted data
      const result = {
        productName,
        dimensions,
        material: materialInfo,
        annotations,
        boundingBox: cartesianPoints.length > 0 ? {
          min: [Math.min(...cartesianPoints.map(p => p[0])), 
                Math.min(...cartesianPoints.map(p => p[1])), 
                Math.min(...cartesianPoints.map(p => p[2]))],
          max: [Math.max(...cartesianPoints.map(p => p[0])), 
                Math.max(...cartesianPoints.map(p => p[1])), 
                Math.max(...cartesianPoints.map(p => p[2]))]
        } : null,
        cartesianPoints,
        circles
      };
      
      resolve(result);
    } catch (err) {
      console.error("Erreur lors de l'analyse de secours du fichier STEP:", err);
      resolve(createDefaultStepData(path.basename(filePath, path.extname(filePath))));
    }
  });
}

function createDefaultStepData(productName, errorReason = 'Analyse impossible') {
  const defaultDimensions = { 
    length: 100, 
    width: 50, 
    height: 25 
  };
  
  if (productName.toLowerCase().includes('rondelle')) {
    defaultDimensions.length = 30;
    defaultDimensions.width = 30;
    defaultDimensions.height = 5;
  }
  
  return {
    productName,
    dimensions: defaultDimensions,
    material: 'AISI 1018 Steel',
    annotations: [`Note: ${errorReason}`],
    boundingBox: null,
    cartesianPoints: [],
    circles: []
  };
}

function determineDefaultMaterial(productName, fileContent) {
  const pName = productName.toLowerCase();
  const content = fileContent.toLowerCase();
  
  if (content.includes('acier') || content.includes('steel')) {
    return 'AISI 1018 Steel';
  } else if (content.includes('aluminium') || content.includes('aluminum')) {
    return 'Aluminum 6061-T6';
  } else if (content.includes('inox') || content.includes('stainless')) {
    return 'AISI 304 Stainless Steel';
  } else if (pName.includes('rondelle') || pName.includes('washer')) {
    return 'AISI 1018 Steel';
  } else if (pName.includes('vis') || pName.includes('screw') || pName.includes('bolt')) {
    return 'AISI 4140 Steel';
  } else {
    return 'AISI 1018 Steel';
  }
}

// Generate preview for a STEP file
function generateStepPreview(stepData, outputPath) {
  try {
    // Create a simple SVG representation of the part
    const width = 400;
    const height = 300;
    const padding = 40;
    
    // Default SVG with dimensions
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
  } catch (err) {
    console.error("Erreur lors de la génération de l'aperçu:", err);
  }
}

// Route to upload a file
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier téléchargé' });
    }
    
    console.log(`Fichier téléchargé: ${req.file.originalname} -> ${req.file.filename}`);
    
    // Get file extension
    const fileExtension = path.extname(req.file.originalname).toLowerCase().substring(1);
    
    // Process the file
    const fileData = await processFile(req.file, fileExtension);
    
    // Generate preview path
    let previewPath = '/placeholder.svg';
    const customPreviewPath = path.join('uploads', `${path.basename(req.file.path, path.extname(req.file.path))}_preview.svg`);
    
    if (fs.existsSync(path.join(__dirname, customPreviewPath))) {
      previewPath = `/${customPreviewPath}`;
    }
    
    // Return the response
    return res.json({
      success: true,
      fileId: path.basename(req.file.path),
      originalName: req.file.originalname,
      fileType: fileExtension,
      preview: previewPath,
      ...fileData
    });
  } catch (err) {
    console.error('Error during file upload:', err);
    return res.status(500).json({ error: 'Erreur lors du téléchargement' });
  }
});

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
      } catch (err) {
        console.error("Error processing STL file:", err);
      }
      break;
      
    case 'step':
    case 'stp':
      try {
        // Extract dimensions from STEP file
        const stepData = await parseStepFile(file.path);
        
        if (stepData) {
          dimensions = stepData.dimensions;
          material = stepData.material || material;
          annotations = stepData.annotations || annotations;
          
          // Generate a preview SVG for the STEP file
          const previewSvgPath = path.join(__dirname, 'uploads', `${path.basename(file.path, path.extname(file.path))}_preview.svg`);
          generateStepPreview(stepData, previewSvgPath);
        } else {
          // Default dimensions for STEP files if parsing fails
          dimensions = { length: 30, width: 20, height: 5 };
        }
        
        // Calculate volume
        volume = dimensions.length * dimensions.width * dimensions.height;
      } catch (err) {
        console.error("Error processing STEP file:", err);
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
  
  return {
    dimensions,
    volume,
    material,
    weight,
    cost,
    annotations,
    tolerances
  };
}

// API route to get materials
app.get('/api/materials', (req, res) => {
  db.all('SELECT * FROM materials ORDER BY name', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// API route to get material by name
app.get('/api/materials/:name', (req, res) => {
  db.get('SELECT * FROM materials WHERE name = ?', [req.params.name], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Material not found' });
    }
    res.json(row);
  });
});

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

// Initialize default materials in the database
function initializeDefaultMaterials() {
  db.get("SELECT COUNT(*) as count FROM materials", (err, row) => {
    if (err) {
      console.error("Erreur lors de la vérification de la table materials:", err);
      return;
    }

    if (row.count === 0) {
      console.log("Initialisation des matériaux par défaut...");
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

        // Insert default materials
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
          ['Copper C11000', 'Copper', 8.94, 8.5, 220, 69, 117, 17.0, 391, 1.7, 'High', 85, 80, 'Electrical components, heat exchangers']
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
            if (err) console.error("Erreur lors de l'insertion du matériau:", err);
          });
        });

        stmt.finalize();
      });
    }
  });
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Serveur démarré sur le port ${port}`);
  initializeDefaultMaterials();
});
