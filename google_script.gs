function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No se recibieron datos en la solicitud.");
    }

    var data = JSON.parse(e.postData.contents);
    
    // 1. Obtener fecha actual para el nombre (DDMMYYYY)
    var today = new Date();
    var dateString = Utilities.formatDate(today, "GMT+1", "ddMMyyyy");
    var fileName = "Ideas_" + dateString;
    
    // 2. Buscar si ya existe el archivo de hoy
    var files = DriveApp.getFilesByName(fileName);
    var ss;
    
    if (files.hasNext()) {
      ss = SpreadsheetApp.open(files.next());
    } else {
      // 3. Si no existe, buscar la plantilla y copiarla
      var templateName = "Plantilla novedades"; 
      var templates = DriveApp.getFilesByName(templateName);
      
      if (!templates.hasNext()) {
        // Intentar con extensión si no lo encuentra por nombre exacto
        templates = DriveApp.getFilesByName(templateName + ".xls");
      }
      if (!templates.hasNext()) {
        templates = DriveApp.getFilesByName(templateName + ".xlsx");
      }
      
      if (templates.hasNext()) {
        var templateFile = templates.next();
        var newFile = templateFile.makeCopy(fileName);
        ss = SpreadsheetApp.open(newFile);
      } else {
        throw new Error("No se encontró el archivo '" + templateName + "' en tu Google Drive. Por favor, asegúrate de que el archivo existe y se llama así.");
      }
    }
    
    var sheet = ss.getSheets()[0];

    // --- Lógica de inserción ---
    // Buscamos la primera fila vacía en la columna D, empezando desde la 4
    var values = sheet.getRange("D:D").getValues();
    var lastRowWithData = 0;
    
    // Recorrer para encontrar el último bloque
    for (var i = 3; i < values.length; i++) {
      if (values[i][0] != "") {
        lastRowWithData = i + 1;
      }
    }

    // Calculamos el inicio del nuevo bloque (cada 10 filas, empezando en 4)
    var startRow = 4;
    if (lastRowWithData >= 4) {
      startRow = (Math.floor((lastRowWithData - 4) / 10) + 1) * 10 + 4;
    }

    // Rellenar Texto
    sheet.getRange("D" + startRow).setValue(data.name || "");
    sheet.getRange("D" + (startRow + 1)).setValue(data.desc || "");
    sheet.getRange("D" + (startRow + 3)).setValue(data.size || "");
    sheet.getRange("D" + (startRow + 4)).setValue(data.qty || "");
    sheet.getRange("D" + (startRow + 5)).setValue(data.text || "");
    sheet.getRange("D" + (startRow + 6)).setValue(data.sample || "");
    sheet.getRange("D" + (startRow + 7)).setValue(data.zone || "");

    // Rellenar Fotos
    var photoRow = startRow + 1; // Las fotos suelen ir a partir de la fila +1 del inicio
    if (data.images && data.images.length > 0) {
      var columns = [6, 7, 8]; // F, G, H (6, 7, 8)
      data.images.forEach(function(imgBase64, index) {
        if (imgBase64 && index < 3) {
          try {
            var parts = imgBase64.split(",");
            if (parts.length > 1) {
              var base64Data = parts[1];
              var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), "image/jpeg", "foto_" + index + "_" + Date.now() + ".jpg");
              
              // Intentar insertar la imagen
              var image = sheet.insertImage(blob, columns[index], photoRow);
              
              // Ajustar tamaño para que quepa en el hueco aproximado
              var originalWidth = image.getWidth();
              var originalHeight = image.getHeight();
              var ratio = originalWidth / originalHeight;
              
              image.setHeight(150);
              image.setWidth(150 * ratio);
            }
          } catch (e) {
            console.error("Error insertando imagen " + index + ": " + e.toString());
          }
        }
      });
    }

    return ContentService.createTextOutput(JSON.stringify({"status": "success", "message": "Datos guardados en " + fileName, "row": startRow}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
