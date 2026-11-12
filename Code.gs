/**
 * Émargement par QR code avec signature manuscrite — version Google (Sheets + Drive + Apps Script).
 *
 * - L'onglet « Évènements » liste les évènements (statut Brouillon / Ouvert / Clos).
 * - Chaque évènement a une adresse publique (le QR code) : on y remplit le formulaire et on signe au doigt.
 * - Les signatures sont des images PNG dans un dossier Google Drive ; l'onglet « Émargements » a une ligne
 *   par signature (une par personne et par jour, numérotée 1, 2, 3… chaque jour).
 * - Le menu « Émargement » génère la feuille d'émargement en PDF avec les signatures.
 *
 * Toutes les données restent dans le Google Drive du compte qui installe le script.
 */

var SHEET_EVENTS = 'Évènements';
var SHEET_ROWS = 'Émargements';
var EVENT_HEADERS = ['Titre', 'Premier jour', 'Dernier jour', 'Statut', 'Jeton (ne pas modifier)', 'Créé le'];
var ROW_HEADERS = ['Jeton évènement', 'Évènement', 'Jour', 'N°', 'Nom et prénoms', 'Genre', 'Structure', 'Fonction',
  'Pays', 'Ville', 'E-mail', 'Téléphone', 'Clé téléphone', 'Signature (lien)', 'ID fichier signature', 'Horodatage'];
var STATUS = {DRAFT: 'Brouillon', OPEN: 'Ouvert', CLOSED: 'Clos'};
var PHONE_KEY_DIGITS = 9;
var SIGNATURE_MAX_BYTES = 400 * 1024;

// Colonnes (0 = première) de l'onglet Émargements.
var C = {TOKEN: 0, TITLE: 1, DAY: 2, NUMBER: 3, NAME: 4, GENDER: 5, ORG: 6, POSITION: 7, COUNTRY: 8, CITY: 9,
  EMAIL: 10, PHONE: 11, PHONE_KEY: 12, LINK: 13, FILE_ID: 14, AT: 15};
var GENDERS = ['Femme', 'Homme', 'Ne souhaite pas répondre'];


// ============================================================================================
// Menu dans la feuille (équipe)
// ============================================================================================

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Émargement')
    .addItem('1. Installer (une seule fois)', 'installer')
    .addItem('2. Enregistrer l’adresse de l’application web', 'enregistrerAdresse')
    .addItem('3. Enregistrer l’adresse de la page publique', 'enregistrerPagePublique')
    .addSeparator()
    .addItem('Nouvel évènement…', 'nouvelEvenement')
    .addItem('QR code et affiche (évènement sélectionné)', 'afficherQr')
    .addItem('Feuille d’émargement PDF (évènement sélectionné)', 'genererPdf')
    .addItem('Export Excel, sans signatures (évènement sélectionné)', 'exporterExcel')
    .addToUi();
}

function installer() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getScriptProperties();
  props.setProperty('SPREADSHEET_ID', ss.getId());

  var events = ss.getSheetByName(SHEET_EVENTS) || ss.insertSheet(SHEET_EVENTS, 0);
  events.getRange(1, 1, 1, EVENT_HEADERS.length).setValues([EVENT_HEADERS]).setFontWeight('bold')
    .setBackground('#ddebf7');
  events.setFrozenRows(1);
  events.getRange('B2:C').setNumberFormat('dd/mm/yyyy');
  events.getRange('D2:D').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList([STATUS.DRAFT, STATUS.OPEN, STATUS.CLOSED], true).build());
  events.getRange('E:E').setFontColor('#888888');
  events.setColumnWidth(1, 320);

  var rows = ss.getSheetByName(SHEET_ROWS) || ss.insertSheet(SHEET_ROWS, 1);
  rows.getRange(1, 1, 1, ROW_HEADERS.length).setValues([ROW_HEADERS]).setFontWeight('bold')
    .setBackground('#ddebf7');
  rows.setFrozenRows(1);
  rows.getRange('C2:C').setNumberFormat('dd/mm/yyyy');
  rows.getRange('K2:M').setNumberFormat('@');

  var defaultSheet = ss.getSheetByName('Feuille 1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 2 && defaultSheet.getLastRow() === 0) ss.deleteSheet(defaultSheet);

  folder_('SIGNATURES_FOLDER_ID', 'Émargement — signatures');
  folder_('PDF_FOLDER_ID', 'Émargement — feuilles PDF');
  folder_('XLSX_FOLDER_ID', 'Émargement — exports Excel');
  SpreadsheetApp.getUi().alert('Installation terminée.\n\nÉtape suivante : Déployer > Nouveau déploiement > ' +
    'Application Web (voir le guide), puis menu Émargement > 2. Enregistrer l’adresse de l’application web.');
}

function enregistrerAdresse() {
  var ui = SpreadsheetApp.getUi();
  var guess = '';
  try { guess = ScriptApp.getService().getUrl() || ''; } catch (e) { /* pas encore déployé */ }
  var answer = ui.prompt('Adresse de l’application web',
    'Collez l’adresse donnée au déploiement (elle se termine par /exec).' +
    (guess ? '\n\nAdresse détectée : ' + guess : ''), ui.ButtonSet.OK_CANCEL);
  if (answer.getSelectedButton() !== ui.Button.OK) return;
  var url = (answer.getResponseText() || guess).trim();
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) {
    ui.alert('Cette adresse ne se termine pas par /exec. Copiez celle de « Application Web » dans la fenêtre ' +
      'du déploiement (pas celle du test, qui se termine par /dev).');
    return;
  }
  PropertiesService.getScriptProperties().setProperty('WEBAPP_URL', url);
  ui.alert('Adresse enregistrée.');
}

/**
 * Adresse de la page publique hébergée hors de Google (dossier « page-publique »). Les QR codes pointent alors
 * vers elle : elle évite l'erreur « Impossible d'ouvrir le fichier » des téléphones connectés à plusieurs
 * comptes Google. Laisser vide pour revenir à la page servie par Google.
 */
function enregistrerPagePublique() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var current = props.getProperty('PUBLIC_URL') || '';
  var answer = ui.prompt('Adresse de la page publique',
    'Collez l’adresse de la page publique (ex. https://mon-compte.github.io/emargement/).\n' +
    'Laissez vide et validez pour ne plus l’utiliser.' + (current ? '\n\nAdresse actuelle : ' + current : ''),
    ui.ButtonSet.OK_CANCEL);
  if (answer.getSelectedButton() !== ui.Button.OK) return;
  var url = answer.getResponseText().trim().replace(/[?#].*$/, '');
  if (!url) {
    props.deleteProperty('PUBLIC_URL');
    ui.alert('Page publique désactivée : les QR codes pointent de nouveau vers la page Google.');
    return;
  }
  if (!/^https:\/\/[^\s]+$/.test(url) || /script\.google\.com/.test(url)) {
    ui.alert('Adresse non valide : elle doit commencer par https:// et ne pas être une adresse script.google.com.');
    return;
  }
  props.setProperty('PUBLIC_URL', url);
  ui.alert('Adresse enregistrée. Les QR codes et affiches pointent maintenant vers la page publique.\n\n' +
    'Pensez à réimprimer les affiches déjà imprimées.');
}

/** Adresse derrière le QR code d'un évènement : la page publique si elle est configurée, sinon la page Google. */
function signUrl_(token, base) {
  var publicUrl = PropertiesService.getScriptProperties().getProperty('PUBLIC_URL');
  return (publicUrl || base) + '?e=' + token;
}

function nouvelEvenement() {
  var ui = SpreadsheetApp.getUi();
  var title = ask_(ui, 'Titre de l’évènement', 'Exemple : Atelier de restitution');
  if (!title) return;
  var start = askDate_(ui, 'Premier jour', 'Format JJ/MM/AAAA, ex. 10/11/2026');
  if (!start) return;
  var end = askDate_(ui, 'Dernier jour', 'Format JJ/MM/AAAA (le même jour si l’évènement dure un jour)');
  if (!end) return;
  if (end < start) { ui.alert('Le dernier jour ne peut pas précéder le premier.'); return; }
  sheet_(SHEET_EVENTS).appendRow([title, start, end, STATUS.DRAFT, newToken_(), new Date()]);
  ui.alert('Évènement créé (statut Brouillon).\n\nPassez son statut à « Ouvert » dans l’onglet Évènements quand ' +
    'la liste doit être disponible, puis utilisez « QR code et affiche ».');
}

function afficherQr() {
  var event = selectedEvent_();
  if (!event) return;
  var base = webAppUrl_();
  if (!base) return;
  var template = HtmlService.createTemplateFromFile('Affiche');
  template.event = eventView_(event);
  template.signUrl = signUrl_(event.token, base);
  template.posterUrl = base + '?e=' + event.token + '&p=affiche';
  template.dialog = true;
  SpreadsheetApp.getUi().showModalDialog(template.evaluate().setWidth(460).setHeight(620), 'QR code — ' + event.title);
}

function genererPdf() {
  var event = selectedEvent_();
  if (!event) return;
  var only = askDay_('Feuille d’émargement PDF', 'Jour à imprimer');
  if (only === null) return;
  var file = buildPdf_(event, only);
  showLink_('Feuille d’émargement', 'PDF enregistré dans le dossier « Émargement — feuilles PDF » de votre Drive.',
    file.getUrl(), 'Ouvrir le PDF');
}

function exporterExcel() {
  var event = selectedEvent_();
  if (!event) return;
  var only = askDay_('Export Excel (sans signatures)', 'Jour à exporter');
  if (only === null) return;
  var file = buildXlsx_(event, only);
  showLink_('Export Excel', 'Fichier Excel enregistré dans le dossier « Émargement — exports Excel » de votre Drive.',
    file.getUrl(), 'Ouvrir le fichier');
}

/** Demande un jour : renvoie « AAAA-MM-JJ », '' pour tous les jours, ou null si annulé / date invalide. */
function askDay_(title, what) {
  var ui = SpreadsheetApp.getUi();
  var answer = ui.prompt(title, what + ' (JJ/MM/AAAA), ou laissez vide pour tous les jours.', ui.ButtonSet.OK_CANCEL);
  if (answer.getSelectedButton() !== ui.Button.OK) return null;
  var text = answer.getResponseText().trim();
  if (!text) return '';
  var date = parseDate_(text);
  if (!date) { ui.alert('Date non reconnue.'); return null; }
  return iso_(date);
}

function showLink_(title, message, url, label) {
  var html = HtmlService.createHtmlOutput('<p style="font-family:Arial">' + message + '</p>' +
    '<p style="font-family:Arial"><a target="_blank" href="' + url + '">' + label + '</a></p>')
    .setWidth(380).setHeight(150);
  SpreadsheetApp.getUi().showModalDialog(html, title);
}


// ============================================================================================
// Application web publique (derrière le QR code)
// ============================================================================================

function doGet(e) {
  if (e && e.parameter && e.parameter.action) return api_(e.parameter.action, e.parameter);
  var token = (e && e.parameter && e.parameter.e) || '';
  var event = token ? findEvent_(token) : null;
  if (!event || event.status === STATUS.DRAFT) {
    return HtmlService.createHtmlOutput('<p style="font-family:Arial;padding:2em">Cette page n’existe pas.</p>')
      .setTitle('Émargement');
  }
  var base = webAppUrl_(true);
  var view = eventView_(event);
  var template;
  if (e.parameter.p === 'affiche') {
    template = HtmlService.createTemplateFromFile('Affiche');
    template.signUrl = signUrl_(event.token, base);
    template.posterUrl = '';
    template.dialog = false;
  } else {
    template = HtmlService.createTemplateFromFile('Signer');
    template.signingDay = isSigningDay_(event);
  }
  template.event = view;
  return template.evaluate()
    .setTitle(event.title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Signature envoyée par la page publique hébergée hors de Google (corps JSON {e, form}, en text/plain pour
 * éviter une requête CORS préalable).
 */
function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({error: 'Requête illisible.'});
  }
  try {
    return json_(signer(String(body.e || ''), body.form || {}));
  } catch (err) {
    return json_({error: 'Erreur du serveur. Réessayez dans un instant.'});
  }
}

/** Lectures de la page publique : ?action=event | check | participants. */
function api_(action, p) {
  try {
    var token = String(p.e || '');
    if (action === 'event') {
      var event = findEvent_(token);
      if (!event || event.status === STATUS.DRAFT) return json_({event: null});
      var view = eventView_(event);
      view.signingDay = isSigningDay_(event);
      return json_({event: view});
    }
    if (action === 'check') return json_({found: verifier(token, p.contact)});
    if (action === 'participants') return json_({data: participants(token, String(p.day || ''))});
    return json_({error: 'Action inconnue.'});
  } catch (err) {
    return json_({error: 'Erreur du serveur. Réessayez dans un instant.'});
  }
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

/** Appelée par la page publique. Renvoie {ok, number, day, already} ou {error}. */
function signer(token, form) {
  var data;
  try {
    data = cleanForm_(form);
  } catch (err) {
    return {error: err.message};
  }
  if (data.honeypot) return {ok: true, number: 0, day: '', already: false};

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return {error: 'Beaucoup de personnes signent en ce moment. Patientez quelques secondes et réessayez.'};
  }
  try {
    var event = findEvent_(token);
    if (!event || !isSigningDay_(event)) return {error: 'La liste n’est pas ouverte aujourd’hui.'};
    var day = today_();
    var sheet = sheet_(SHEET_ROWS);
    var values = sheet.getDataRange().getValues();
    var last = 0;
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      if (row[C.TOKEN] !== token || isoOf_(row[C.DAY]) !== day) continue;
      last = Math.max(last, Number(row[C.NUMBER]) || 0);
      var sameEmail = data.email && String(row[C.EMAIL]).toLowerCase() === data.email;
      var samePhone = data.phoneKey && String(row[C.PHONE_KEY]) === data.phoneKey;
      if (sameEmail || samePhone) {
        return {ok: true, number: row[C.NUMBER], day: label_(day), already: true};
      }
    }
    var number = last + 1;
    var blob = Utilities.newBlob(data.signature, 'image/png',
      event.token + '_' + day + '_' + ('00' + number).slice(-3) + '.png');
    var file = folder_('SIGNATURES_FOLDER_ID', 'Émargement — signatures').createFile(blob);
    sheet.appendRow([token, event.title, day, number, text_(data.fullName), data.gender, text_(data.organisation),
      text_(data.position), text_(data.country), text_(data.city),
      // Colonnes au format texte (Installer) : les zéros et le « + » du téléphone sont gardés tels quels.
      data.email, data.phone, data.phoneKey, file.getUrl(), file.getId(), new Date()]);
    SpreadsheetApp.flush();
    return {ok: true, number: number, day: label_(day), already: false};
  } finally {
    lock.releaseLock();
  }
}

/** « Ai-je émargé ? » : les jours et numéros d'un e-mail ou d'un téléphone. */
function verifier(token, contact) {
  contact = String(contact || '').trim().slice(0, 200);
  var event = findEvent_(token);
  if (!event || event.status === STATUS.DRAFT || !contact) return [];
  var email = contact.indexOf('@') >= 0 ? contact.toLowerCase() : '';
  var key = email ? '' : phoneKey_(contact);
  if (!email && key.length < 6) return [];
  return rowsOf_(token).filter(function (row) {
    return email ? String(row[C.EMAIL]).toLowerCase() === email : String(row[C.PHONE_KEY]) === key;
  }).map(function (row) {
    return {day: label_(isoOf_(row[C.DAY])), number: row[C.NUMBER]};
  });
}

/** Les participants d'un jour : numéro, nom abrégé, structure (jamais e-mail, téléphone ni signature). */
function participants(token, dayIso) {
  var event = findEvent_(token);
  if (!event || event.status === STATUS.DRAFT) return null;
  var today = today_();
  var days = eventDays_(event).filter(function (d) { return d <= today; });
  if (!days.length) days = [eventDays_(event)[0]];
  var day = days.indexOf(dayIso) >= 0 ? dayIso : days[days.length - 1];
  var rows = rowsOf_(token).filter(function (row) { return isoOf_(row[C.DAY]) === day; })
    .sort(function (a, b) { return a[C.NUMBER] - b[C.NUMBER]; })
    .map(function (row) {
      return {number: row[C.NUMBER], name: publicName_(String(row[C.NAME])), organisation: String(row[C.ORG])};
    });
  return {
    day: day,
    days: days.map(function (d) { return {iso: d, label: label_(d)}; }),
    rows: rows,
  };
}


// ============================================================================================
// Feuille d'émargement PDF (avec les signatures)
// ============================================================================================

function buildPdf_(event, onlyDay) {
  var tz = Session.getScriptTimeZone();
  var all = rowsOf_(event.token);
  var days = onlyDay ? [onlyDay] : eventDays_(event);
  var doc = DocumentApp.create('tmp-emargement-' + event.token);
  var body = doc.getBody();
  // A4 paysage, marges 1,5 cm.
  body.setPageWidth(842).setPageHeight(595).setMarginLeft(42).setMarginRight(42).setMarginTop(36)
    .setMarginBottom(36);
  var first = true;
  days.forEach(function (day) {
    var rows = all.filter(function (row) { return isoOf_(row[C.DAY]) === day; })
      .sort(function (a, b) { return a[C.NUMBER] - b[C.NUMBER]; });
    if (!rows.length && !onlyDay) return;
    if (!first) body.appendPageBreak();
    first = false;
    body.appendParagraph(event.title).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph('Liste de présence · ' + label_(day) + (rows.length ? ' · ' + genderCounts_(rows) : ''));
    var cells = [['N°', 'Nom et prénoms', 'Genre', 'Structure représentée', 'Fonction', 'Provenance', 'E-mail',
      'Téléphone', 'Signature']];
    rows.forEach(function (row) {
      cells.push([String(row[C.NUMBER]), String(row[C.NAME]), genderShort_(row[C.GENDER]), String(row[C.ORG]),
        String(row[C.POSITION]), row[C.CITY] + ', ' + row[C.COUNTRY], String(row[C.EMAIL]), String(row[C.PHONE]), '']);
    });
    if (!rows.length) cells.push(['', 'Personne n’a encore émargé.', '', '', '', '', '', '', '']);
    var table = body.appendTable(cells);
    var widths = [24, 100, 34, 92, 74, 76, 96, 72, 104];
    var style = {};
    style[DocumentApp.Attribute.FONT_SIZE] = 8;
    table.setAttributes(style);
    for (var c = 0; c < widths.length; c++) table.setColumnWidth(c, widths[c]);
    var header = table.getRow(0);
    for (var h = 0; h < header.getNumCells(); h++) {
      header.getCell(h).setBackgroundColor('#ddebf7').editAsText().setBold(true);
    }
    rows.forEach(function (row, i) {
      var cell = table.getRow(i + 1).getCell(8);
      try {
        var image = cell.getChild(0).asParagraph().appendInlineImage(
          DriveApp.getFileById(row[C.FILE_ID]).getBlob());
        var ratio = image.getHeight() / image.getWidth();
        image.setWidth(100).setHeight(Math.round(100 * ratio));
      } catch (err) {
        cell.setText('(signature introuvable)');
      }
    });
    if (rows.length) {
      body.appendParagraph('Genre : F = femme, H = homme, – = ne souhaite pas répondre').editAsText().setFontSize(7);
    }
  });
  if (first) body.appendParagraph('Personne n’a encore émargé.');
  doc.saveAndClose();
  var temp = DriveApp.getFileById(doc.getId());
  var name = event.title + ' — émargement' + (onlyDay ? ' ' + onlyDay : '') + ' (' +
    Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH\'h\'mm') + ').pdf';
  var pdf = folder_('PDF_FOLDER_ID', 'Émargement — feuilles PDF').createFile(temp.getAs(MimeType.PDF).setName(name));
  temp.setTrashed(true);
  return pdf;
}


// ============================================================================================
// Export Excel (sans les signatures)
// ============================================================================================

function buildXlsx_(event, onlyDay) {
  var tz = Session.getScriptTimeZone();
  var days = onlyDay ? [onlyDay] : eventDays_(event);
  var rows = rowsOf_(event.token).filter(function (row) { return days.indexOf(isoOf_(row[C.DAY])) >= 0; })
    .sort(function (a, b) {
      var da = isoOf_(a[C.DAY]), db = isoOf_(b[C.DAY]);
      return da < db ? -1 : da > db ? 1 : a[C.NUMBER] - b[C.NUMBER];
    });

  var name = event.title + ' — participants' + (onlyDay ? ' ' + onlyDay : '') + ' (' +
    Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH\'h\'mm') + ')';
  var temp = SpreadsheetApp.create('tmp-export-' + event.token);
  try {
    // Onglet 1 : une ligne par émargement.
    var list = temp.getSheets()[0].setName('Participants');
    var headers = ['Jour', 'N°', 'Nom et prénoms', 'Genre', 'Structure', 'Fonction', 'Pays', 'Ville', 'E-mail',
      'Téléphone', 'Horodatage'];
    var cells = rows.map(function (row) {
      return [Utilities.parseDate(isoOf_(row[C.DAY]), tz, 'yyyy-MM-dd'), Number(row[C.NUMBER]) || '',
        text_(row[C.NAME]), String(row[C.GENDER]), text_(row[C.ORG]), text_(row[C.POSITION]), text_(row[C.COUNTRY]),
        text_(row[C.CITY]), text_(row[C.EMAIL]), String(row[C.PHONE]), row[C.AT] instanceof Date ? row[C.AT] : ''];
    });
    list.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#ddebf7');
    if (cells.length) {
      list.getRange(2, 10, cells.length, 1).setNumberFormat('@'); // téléphone : garder 0 et + en tête
      list.getRange(2, 1, cells.length, headers.length).setValues(cells);
      list.getRange(2, 1, cells.length, 1).setNumberFormat('dd/mm/yyyy');
      list.getRange(2, 11, cells.length, 1).setNumberFormat('dd/mm/yyyy hh:mm:ss');
    }
    list.setFrozenRows(1);
    list.autoResizeColumns(1, headers.length);

    // Onglet 2 : totaux par jour et par genre.
    var totals = temp.insertSheet('Totaux');
    var table = [['Jour', 'Total', 'Femmes', 'Hommes', 'Non précisé']];
    days.forEach(function (day) {
      var ofDay = rows.filter(function (row) { return isoOf_(row[C.DAY]) === day; });
      var count = {F: 0, H: 0, '–': 0};
      ofDay.forEach(function (row) { var g = genderShort_(row[C.GENDER]); if (g) count[g]++; });
      table.push([Utilities.parseDate(day, tz, 'yyyy-MM-dd'), ofDay.length, count.F, count.H, count['–']]);
    });
    totals.getRange(1, 1, table.length, 5).setValues(table);
    totals.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#ddebf7');
    totals.getRange(2, 1, Math.max(table.length - 1, 1), 1).setNumberFormat('dd/mm/yyyy');
    totals.autoResizeColumns(1, 5);
    SpreadsheetApp.flush();

    var response = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + temp.getId() + '/export?format=xlsx',
      {headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}, muteHttpExceptions: true});
    if (response.getResponseCode() !== 200) {
      throw new Error('Google n’a pas pu convertir le fichier (code ' + response.getResponseCode() + '). Réessayez.');
    }
    var blob = response.getBlob().setName(name + '.xlsx');
    return folder_('XLSX_FOLDER_ID', 'Émargement — exports Excel').createFile(blob);
  } finally {
    DriveApp.getFileById(temp.getId()).setTrashed(true);
  }
}


// ============================================================================================
// Outils
// ============================================================================================

function cleanForm_(form) {
  form = form || {};
  function field(name, label, max, required) {
    var value = String(form[name] || '').trim().replace(/\s+/g, ' ');
    if (required && !value) throw new Error('Champ obligatoire : ' + label + '.');
    if (value.length > max) throw new Error('Trop long : ' + label + '.');
    return value;
  }
  var data = {
    honeypot: String(form.website || ''),
    fullName: field('fullName', 'nom et prénoms', 200, true),
    gender: field('gender', 'genre', 40, true),
    organisation: field('organisation', 'structure', 200, true),
    position: field('position', 'fonction', 200, true),
    country: field('country', 'pays', 100, true),
    city: field('city', 'ville', 100, true),
    email: field('email', 'e-mail', 200, false).toLowerCase(),
    phone: field('phone', 'téléphone', 40, false),
  };
  if (GENDERS.indexOf(data.gender) < 0) throw new Error('Champ obligatoire : genre.');
  if (data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) throw new Error('Saisissez un e-mail valide.');
  data.phoneKey = phoneKey_(data.phone);
  if (data.phone && data.phone.replace(/\D/g, '').length < 6) {
    throw new Error('Saisissez un numéro de téléphone valide.');
  }
  if (!data.email && !data.phone) throw new Error('Indiquez un e-mail ou un numéro de téléphone (au moins un).');
  var prefix = 'data:image/png;base64,';
  var url = String(form.signature || '');
  if (url.indexOf(prefix) !== 0) throw new Error('Signez dans le cadre.');
  var bytes;
  try {
    bytes = Utilities.base64Decode(url.slice(prefix.length));
  } catch (err) {
    throw new Error('La signature n’a pas pu être lue : signez à nouveau.');
  }
  // Une vraie image PNG (signature 0x89 P N G), pas trop lourde.
  if (bytes.length > SIGNATURE_MAX_BYTES || bytes.length < 8 || (bytes[0] & 0xff) !== 0x89 || bytes[1] !== 0x50 ||
      bytes[2] !== 0x4e || bytes[3] !== 0x47) {
    throw new Error('La signature n’a pas pu être lue : signez à nouveau.');
  }
  data.signature = bytes;
  return data;
}

function spreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(name) {
  var sheet = spreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('Onglet « ' + name + ' » introuvable : lancez Émargement > Installer.');
  return sheet;
}

function folder_(property, name) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(property);
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (err) { /* supprimé : on le recrée */ }
  }
  var folder = DriveApp.createFolder(name);
  props.setProperty(property, folder.getId());
  return folder;
}

function webAppUrl_(silent) {
  var url = PropertiesService.getScriptProperties().getProperty('WEBAPP_URL');
  if (!url) {
    try { url = ScriptApp.getService().getUrl(); } catch (err) { url = ''; }
  }
  if (!url && !silent) {
    SpreadsheetApp.getUi().alert('Déployez d’abord l’application web, puis lancez Émargement > 2. Enregistrer ' +
      'l’adresse de l’application web.');
  }
  return url;
}

function findEvent_(token) {
  if (!token) return null;
  var values = sheet_(SHEET_EVENTS).getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][4] === token) return eventOf_(values[i]);
  }
  return null;
}

function eventOf_(row) {
  return {title: String(row[0]), start: isoOf_(row[1]), end: isoOf_(row[2]), status: String(row[3]).trim(),
    token: String(row[4])};
}

function selectedEvent_() {
  var ui = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSheet();
  var row = sheet.getActiveRange() ? sheet.getActiveRange().getRow() : 0;
  if (sheet.getName() !== SHEET_EVENTS || row < 2) {
    ui.alert('Dans l’onglet « Évènements », cliquez d’abord sur la ligne de l’évènement.');
    return null;
  }
  var event = eventOf_(sheet.getRange(row, 1, 1, EVENT_HEADERS.length).getValues()[0]);
  if (!event.token || !event.start || !event.end) {
    ui.alert('Cette ligne n’est pas un évènement complet (titre, dates et jeton). Créez-le avec « Nouvel évènement ».');
    return null;
  }
  return event;
}

function eventView_(event) {
  return {title: event.title, token: event.token, status: event.status, start: label_(event.start),
    end: label_(event.end), oneDay: event.start === event.end};
}

function rowsOf_(token) {
  return sheet_(SHEET_ROWS).getDataRange().getValues().slice(1).filter(function (row) {
    return row[C.TOKEN] === token;
  });
}

function isSigningDay_(event) {
  var day = today_();
  return event.status === STATUS.OPEN && event.start <= day && day <= event.end;
}

function eventDays_(event) {
  var days = [];
  var d = new Date(event.start + 'T12:00:00Z');
  var end = new Date(event.end + 'T12:00:00Z');
  while (d <= end && days.length < 366) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

function today_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/** Une date de la feuille (objet Date ou texte) en « AAAA-MM-JJ ». */
function isoOf_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  var parsed = parseDate_(text);
  return parsed ? iso_(parsed) : '';
}

function iso_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/** « JJ/MM/AAAA » en Date (midi, pour éviter les décalages de fuseau), sinon null. */
function parseDate_(text) {
  var m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(String(text).trim());
  if (!m) return null;
  var date = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12);
  return date.getDate() === Number(m[1]) && date.getMonth() === Number(m[2]) - 1 ? date : null;
}

var MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre',
  'novembre', 'décembre'];

function label_(iso) {
  if (!iso) return '';
  var p = iso.split('-');
  return Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1] + ' ' + p[0];
}

function genderShort_(gender) {
  return {'Femme': 'F', 'Homme': 'H', 'Ne souhaite pas répondre': '–'}[String(gender)] || '';
}

/** « 12 participants (Femmes : 7, Hommes : 4, non précisé : 1) ». */
function genderCounts_(rows) {
  var count = {F: 0, H: 0, '–': 0};
  rows.forEach(function (row) { var g = genderShort_(row[C.GENDER]); if (g) count[g]++; });
  return rows.length + ' participant' + (rows.length > 1 ? 's' : '') + ' (Femmes : ' + count.F + ', Hommes : ' +
    count.H + (count['–'] ? ', non précisé : ' + count['–'] : '') + ')';
}

function phoneKey_(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-PHONE_KEY_DIGITS);
}

function publicName_(fullName) {
  var words = fullName.trim().split(/\s+/).filter(String);
  if (!words.length) return '';
  return [words[0]].concat(words.slice(1).map(function (w) { return w.charAt(0).toUpperCase() + '.'; })).join(' ');
}

/** Empêche qu'une saisie commençant par = + - @ soit prise pour une formule. */
function text_(value) {
  value = String(value || '');
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function newToken_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 20);
}

function ask_(ui, title, hint) {
  var answer = ui.prompt(title, hint, ui.ButtonSet.OK_CANCEL);
  if (answer.getSelectedButton() !== ui.Button.OK) return '';
  return answer.getResponseText().trim();
}

function askDate_(ui, title, hint) {
  while (true) {
    var text = ask_(ui, title, hint);
    if (!text) return null;
    var date = parseDate_(text);
    if (date) return date;
    ui.alert('Date non reconnue : utilisez le format JJ/MM/AAAA.');
  }
}
