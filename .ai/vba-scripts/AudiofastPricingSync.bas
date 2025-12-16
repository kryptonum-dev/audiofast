' ============================================================
' AUDIOFAST PRICING SYNC - VBA MACRO FOR MAC EXCEL
' ============================================================
' This macro reads pricing data from Excel sheets and syncs
' to Supabase via AppleScript + Python (for UTF-8 support)
' ============================================================

Option Explicit

' ------------------------------------------------------------
' CONFIGURATION
' ------------------------------------------------------------
Private Const SUPABASE_URL As String = "https://xuwapsacaymdemmvblak.supabase.co"
Private Const ENDPOINT As String = SUPABASE_URL & "/functions/v1/pricing-ingest"
Private Const ANON_KEY As String = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1d2Fwc2FjYXltZGVtbXZibGFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTg3ODYsImV4cCI6MjA3MjM5NDc4Nn0.qMH2oXCcutbLFdg-IBgJkyfjhq2mQftEUBYfr8e8s2Y"

' Sheet names
Private Const SHEET_USTAWIENIA As String = "Ustawienia"
Private Const SHEET_PRODUKTY As String = "Produkty"
Private Const SHEET_OPCJE As String = "Opcje"
Private Const SHEET_WARTOSCI As String = "Wartości"
Private Const SHEET_LISTY As String = "Listy"

' Data start rows
Private Const START_ROW_PRODUKTY As Long = 6
Private Const START_ROW_OPCJE As Long = 3
Private Const START_ROW_WARTOSCI As Long = 2
Private Const START_ROW_LISTY As Long = 2

' Password cell
Private Const PASSWORD_CELL As String = "B1"

' ============================================================
' MAIN ENTRY POINT - Call this to sync pricing
' ============================================================
Public Sub SyncPricingToSupabase()
    Dim password As String
    Dim jsonPayload As String
    Dim hexPayload As String
    Dim param As String
    Dim result As String
    Dim startTime As Double
    
    On Error GoTo ErrorHandler
    
    startTime = Timer
    
    ' Step 1: Get password from Ustawienia sheet
    password = GetPassword()
    If Len(password) < 8 Then
        MsgBox "ERROR: Password must be at least 8 characters." & vbCrLf & _
               "Check cell B1 in 'Ustawienia' sheet.", vbCritical, "Audiofast Sync"
        Exit Sub
    End If
    
    ' Step 2: Build JSON payload
    Application.StatusBar = "Building data..."
    jsonPayload = BuildFullPayload()
    
    If Len(jsonPayload) = 0 Then
        MsgBox "ERROR: Failed to build data." & vbCrLf & _
               "Check if sheets have correct structure.", vbCritical, "Audiofast Sync"
        Exit Sub
    End If
    
    ' Step 3: Convert to hex (for UTF-8 safe transport)
    Application.StatusBar = "Encoding data..."
    hexPayload = StringToUtf8Hex(jsonPayload)
    
    ' Step 4: Send to Supabase via AppleScript + Python
    Application.StatusBar = "Sending to server..."
    param = ENDPOINT & "|||" & ANON_KEY & "|||" & password & "|||" & hexPayload
    
    result = AppleScriptTask("AudiofastSync.scpt", "syncPricing", param)
    
    ' Step 5: Show result
    Application.StatusBar = False
    
    Dim elapsed As Double
    elapsed = Round(Timer - startTime, 1)
    
    If InStr(result, """ok"": true") > 0 Or InStr(result, """ok"":true") > 0 Then
        MsgBox "SYNC COMPLETED SUCCESSFULLY!" & vbCrLf & vbCrLf & _
               "Time: " & elapsed & " seconds" & vbCrLf & vbCrLf & _
               "Server response:" & vbCrLf & Left(result, 500), vbInformation, "Audiofast Sync"
    Else
        MsgBox "WARNING: Check server response:" & vbCrLf & vbCrLf & _
               Left(result, 600), vbExclamation, "Audiofast Sync"
    End If
    
    Exit Sub
    
ErrorHandler:
    Application.StatusBar = False
    MsgBox "ERROR: " & Err.Description, vbCritical, "Audiofast Sync"
End Sub

' ============================================================
' GET PASSWORD FROM USTAWIENIA SHEET
' ============================================================
Private Function GetPassword() As String
    Dim ws As Worksheet
    
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(SHEET_USTAWIENIA)
    On Error GoTo 0
    
    If ws Is Nothing Then
        GetPassword = ""
        Exit Function
    End If
    
    GetPassword = Trim(CStr(ws.Range(PASSWORD_CELL).Value))
End Function

' ============================================================
' BUILD FULL JSON PAYLOAD
' ============================================================
Private Function BuildFullPayload() As String
    Dim variants As String
    Dim variantCount As Long
    
    ' Read all sheets and build variants
    variants = BuildVariantsJson(variantCount)
    
    If variantCount = 0 Then
        BuildFullPayload = ""
        Exit Function
    End If
    
    ' Wrap in payload structure
    BuildFullPayload = "{""mode"": ""replace"", ""variants"": [" & variants & "]}"
End Function

' ============================================================
' BUILD VARIANTS JSON FROM PRODUKTY SHEET
' ============================================================
Private Function BuildVariantsJson(ByRef outCount As Long) As String
    Dim wsProd As Worksheet
    Dim wsOpcje As Worksheet
    Dim wsWartosci As Worksheet
    Dim wsListy As Worksheet
    Dim result As String
    Dim lastRow As Long
    Dim i As Long
    Dim brand As String, product As String, model As String
    Dim priceStr As String, priceKey As String
    Dim priceCents As Long
    Dim relatedProducts As String
    Dim groups As String
    Dim variantJson As String
    
    On Error Resume Next
    Set wsProd = ThisWorkbook.Worksheets(SHEET_PRODUKTY)
    Set wsOpcje = ThisWorkbook.Worksheets(SHEET_OPCJE)
    Set wsWartosci = ThisWorkbook.Worksheets(SHEET_WARTOSCI)
    Set wsListy = ThisWorkbook.Worksheets(SHEET_LISTY)
    On Error GoTo 0
    
    If wsProd Is Nothing Then
        outCount = 0
        BuildVariantsJson = ""
        Exit Function
    End If
    
    lastRow = GetLastRow(wsProd, 1)
    result = ""
    outCount = 0
    
    For i = START_ROW_PRODUKTY To lastRow
        brand = SafeString(wsProd.Cells(i, 1).Value)      ' Column A
        product = SafeString(wsProd.Cells(i, 2).Value)    ' Column B
        model = SafeString(wsProd.Cells(i, 3).Value)      ' Column C
        priceStr = SafeString(wsProd.Cells(i, 5).Value)   ' Column E (Cena WWW)
        priceKey = SafeString(wsProd.Cells(i, 7).Value)   ' Column G (URL)
        
        ' Skip empty rows or header rows
        If Len(product) = 0 Or Len(priceKey) = 0 Then GoTo NextRow
        If LCase(product) = "produkt" Or LCase(priceKey) = "url" Then GoTo NextRow
        If InStr(priceKey, "/") = 0 Then GoTo NextRow
        
        ' Parse price to cents
        priceCents = ParsePriceToCents(priceStr)
        
        ' Get related products (columns AA-AJ, indices 27-36 in 1-based)
        relatedProducts = GetRelatedProducts(wsProd, i)
        
        ' Get option groups for this product/model
        groups = BuildGroupsJson(product, model, wsOpcje, wsWartosci, wsListy)
        
        ' Build variant JSON
        variantJson = "{" & _
            """price_key"": " & JsonString(priceKey) & ", " & _
            """brand"": " & JsonString(brand) & ", " & _
            """product"": " & JsonString(product) & ", " & _
            """model"": " & JsonNullableString(model) & ", " & _
            """base_price_cents"": " & CStr(priceCents) & ", " & _
            """currency"": ""PLN"""
        
        ' Add related products if any
        If Len(relatedProducts) > 0 Then
            variantJson = variantJson & ", ""related_products"": [" & relatedProducts & "]"
        End If
        
        ' Add groups
        variantJson = variantJson & ", ""groups"": [" & groups & "]"
        variantJson = variantJson & "}"
        
        ' Append to result
        If Len(result) > 0 Then result = result & ", "
        result = result & variantJson
        outCount = outCount + 1
        
NextRow:
    Next i
    
    BuildVariantsJson = result
End Function

' ============================================================
' GET RELATED PRODUCTS (P1-P10 from columns AA-AJ)
' ============================================================
Private Function GetRelatedProducts(ws As Worksheet, row As Long) As String
    Dim result As String
    Dim col As Long
    Dim val As String
    
    result = ""
    ' Columns AA=27 to AJ=36
    For col = 27 To 36
        val = SafeString(ws.Cells(row, col).Value)
        If Len(val) > 0 Then
            If Len(result) > 0 Then result = result & ", "
            result = result & JsonString(val)
        End If
    Next col
    
    GetRelatedProducts = result
End Function

' ============================================================
' BUILD OPTION GROUPS JSON (Mac-compatible using Collection)
' ============================================================
Private Function BuildGroupsJson(product As String, model As String, _
                                  wsOpcje As Worksheet, wsWartosci As Worksheet, _
                                  wsListy As Worksheet) As String
    Dim result As String
    Dim lastRow As Long
    Dim i As Long
    Dim rowProduct As String, rowModel As String
    Dim opcjaName As String, valueName As String, priceStr As String
    Dim podOpcjaWartosci As String, podOpcjaListy As String
    
    ' Mac-compatible: use parallel arrays instead of Dictionary
    Dim groupNamesList() As String
    Dim groupValuesList() As String
    Dim groupCount As Long
    Dim groupIndex As Long
    
    groupCount = 0
    ReDim groupNamesList(0 To 99)
    ReDim groupValuesList(0 To 99)
    
    result = ""
    
    If wsOpcje Is Nothing Then
        BuildGroupsJson = ""
        Exit Function
    End If
    
    lastRow = GetLastRow(wsOpcje, 1)
    
    ' First pass: collect all parent groups and their values
    For i = START_ROW_OPCJE To lastRow
        rowProduct = SafeString(wsOpcje.Cells(i, 1).Value)  ' Column A
        rowModel = SafeString(wsOpcje.Cells(i, 2).Value)    ' Column B
        opcjaName = SafeString(wsOpcje.Cells(i, 3).Value)   ' Column C
        valueName = SafeString(wsOpcje.Cells(i, 4).Value)   ' Column D
        priceStr = SafeString(wsOpcje.Cells(i, 5).Value)    ' Column E
        podOpcjaWartosci = SafeString(wsOpcje.Cells(i, 6).Value)  ' Column F
        podOpcjaListy = SafeString(wsOpcje.Cells(i, 7).Value)     ' Column G
        
        ' Skip if not matching product/model
        If Not MatchesProductModel(product, model, rowProduct, rowModel) Then GoTo NextOpcja
        If Len(opcjaName) = 0 Then GoTo NextOpcja
        If LCase(opcjaName) = "opcja" Or LCase(rowProduct) = "produkt" Then GoTo NextOpcja
        
        ' Find or add group
        groupIndex = FindInArray(groupNamesList, groupCount, opcjaName)
        If groupIndex = -1 Then
            ' Add new group
            If groupCount <= UBound(groupNamesList) Then
                groupNamesList(groupCount) = opcjaName
                groupValuesList(groupCount) = ""
                groupIndex = groupCount
                groupCount = groupCount + 1
            End If
        End If
        
        ' Add value to group
        If Len(valueName) > 0 And groupIndex >= 0 Then
            Dim valueJson As String
            Dim valuePos As Long
            Dim currentValues As String
            
            currentValues = groupValuesList(groupIndex)
            If Len(currentValues) > 0 Then
                valuePos = UBound(Split(currentValues, "},{")) + 1
            Else
                valuePos = 0
            End If
            
            valueJson = "{""name"": " & JsonString(valueName) & ", " & _
                        """price_delta_cents"": " & CStr(ParsePriceToCents(priceStr)) & ", " & _
                        """position"": " & CStr(valuePos) & "}"
            
            If Len(currentValues) > 0 Then
                groupValuesList(groupIndex) = currentValues & ", " & valueJson
            Else
                groupValuesList(groupIndex) = valueJson
            End If
        End If
        
        ' Handle child groups (Pod-opcja wartości - numeric)
        If Len(podOpcjaWartosci) > 0 And Not IsSuspiciousValue(podOpcjaWartosci) Then
            Dim numericGroup As String
            numericGroup = BuildNumericChildGroup(product, model, opcjaName, valueName, podOpcjaWartosci, wsWartosci)
            If Len(numericGroup) > 0 Then
                If Len(result) > 0 Then result = result & ", "
                result = result & numericGroup
            End If
        End If
        
        ' Handle child groups (Pod-opcja listy - nested select)
        If Len(podOpcjaListy) > 0 And Not IsSuspiciousValue(podOpcjaListy) Then
            Dim listGroup As String
            listGroup = BuildListChildGroup(product, model, opcjaName, valueName, podOpcjaListy, wsListy)
            If Len(listGroup) > 0 Then
                If Len(result) > 0 Then result = result & ", "
                result = result & listGroup
            End If
        End If
        
NextOpcja:
    Next i
    
    ' Build parent groups JSON from arrays
    Dim j As Long
    Dim parentGroups As String
    parentGroups = ""
    
    For j = 0 To groupCount - 1
        Dim groupJson As String
        groupJson = "{""name"": " & JsonString(groupNamesList(j)) & ", " & _
                    """input_type"": ""select"", " & _
                    """required"": false, " & _
                    """position"": " & CStr(j) & ", " & _
                    """values"": [" & groupValuesList(j) & "]}"
        
        If Len(parentGroups) > 0 Then parentGroups = parentGroups & ", "
        parentGroups = parentGroups & groupJson
    Next j
    
    ' Combine parent groups with child groups
    If Len(parentGroups) > 0 And Len(result) > 0 Then
        BuildGroupsJson = parentGroups & ", " & result
    ElseIf Len(parentGroups) > 0 Then
        BuildGroupsJson = parentGroups
    Else
        BuildGroupsJson = result
    End If
End Function

' ============================================================
' HELPER: Find string in array (Mac-compatible dictionary alternative)
' ============================================================
Private Function FindInArray(arr() As String, arrCount As Long, searchVal As String) As Long
    Dim k As Long
    For k = 0 To arrCount - 1
        If LCase(arr(k)) = LCase(searchVal) Then
            FindInArray = k
            Exit Function
        End If
    Next k
    FindInArray = -1
End Function

' ============================================================
' BUILD NUMERIC CHILD GROUP (from Wartości sheet)
' ============================================================
Private Function BuildNumericChildGroup(product As String, model As String, _
                                         parentGroup As String, parentValue As String, _
                                         opcjaName As String, ws As Worksheet) As String
    Dim lastRow As Long
    Dim i As Long
    Dim rowProduct As String, rowModel As String, rowOpcja As String
    Dim minVal As Double, maxVal As Double, stepVal As Double, pricePerStep As Long
    
    If ws Is Nothing Then
        BuildNumericChildGroup = ""
        Exit Function
    End If
    
    lastRow = GetLastRow(ws, 1)
    
    For i = START_ROW_WARTOSCI To lastRow
        rowProduct = SafeString(ws.Cells(i, 1).Value)
        rowModel = SafeString(ws.Cells(i, 2).Value)
        rowOpcja = SafeString(ws.Cells(i, 3).Value)
        
        If Not MatchesProductModel(product, model, rowProduct, rowModel) Then GoTo NextWart
        If LCase(rowOpcja) <> LCase(opcjaName) Then GoTo NextWart
        
        minVal = ParseDecimal(SafeString(ws.Cells(i, 4).Value))
        maxVal = ParseDecimal(SafeString(ws.Cells(i, 5).Value))
        stepVal = ParseDecimal(SafeString(ws.Cells(i, 6).Value))
        pricePerStep = ParsePriceToCents(SafeString(ws.Cells(i, 7).Value))
        
        If stepVal = 0 Then stepVal = 1
        
        BuildNumericChildGroup = "{""name"": " & JsonString(opcjaName) & ", " & _
            """input_type"": ""numeric_step"", " & _
            """required"": false, " & _
            """position"": 0, " & _
            """parent"": {""group_name"": " & JsonString(parentGroup) & ", ""value_name"": " & JsonString(parentValue) & "}, " & _
            """numeric_rule"": {" & _
                """min_value"": " & FormatDecimal(minVal) & ", " & _
                """max_value"": " & FormatDecimal(maxVal) & ", " & _
                """step_value"": " & FormatDecimal(stepVal) & ", " & _
                """price_per_step_cents"": " & CStr(pricePerStep) & ", " & _
                """base_included_value"": " & FormatDecimal(minVal) & _
            "}}"
        Exit Function
        
NextWart:
    Next i
    
    BuildNumericChildGroup = ""
End Function

' ============================================================
' BUILD LIST CHILD GROUP (from Listy sheet)
' ============================================================
Private Function BuildListChildGroup(product As String, model As String, _
                                      parentGroup As String, parentValue As String, _
                                      opcjaName As String, ws As Worksheet) As String
    Dim lastRow As Long
    Dim i As Long
    Dim rowProduct As String, rowModel As String, rowOpcja As String
    Dim valueName As String
    Dim values As String
    Dim valuePos As Long
    
    If ws Is Nothing Then
        BuildListChildGroup = ""
        Exit Function
    End If
    
    lastRow = GetLastRow(ws, 1)
    values = ""
    valuePos = 0
    
    For i = START_ROW_LISTY To lastRow
        rowProduct = SafeString(ws.Cells(i, 1).Value)
        rowModel = SafeString(ws.Cells(i, 2).Value)
        rowOpcja = SafeString(ws.Cells(i, 3).Value)
        valueName = SafeString(ws.Cells(i, 4).Value)
        
        If Not MatchesProductModel(product, model, rowProduct, rowModel) Then GoTo NextList
        If LCase(rowOpcja) <> LCase(opcjaName) Then GoTo NextList
        If Len(valueName) = 0 Then GoTo NextList
        
        Dim priceDelta As Long
        priceDelta = ParsePriceToCents(SafeString(ws.Cells(i, 5).Value))
        
        If Len(values) > 0 Then values = values & ", "
        values = values & "{""name"": " & JsonString(valueName) & ", " & _
                 """price_delta_cents"": " & CStr(priceDelta) & ", " & _
                 """position"": " & CStr(valuePos) & "}"
        valuePos = valuePos + 1
        
NextList:
    Next i
    
    If Len(values) = 0 Then
        BuildListChildGroup = ""
        Exit Function
    End If
    
    BuildListChildGroup = "{""name"": " & JsonString(opcjaName) & ", " & _
        """input_type"": ""select"", " & _
        """required"": false, " & _
        """position"": 0, " & _
        """parent"": {""group_name"": " & JsonString(parentGroup) & ", ""value_name"": " & JsonString(parentValue) & "}, " & _
        """values"": [" & values & "]}"
End Function

' ============================================================
' HELPER: Convert string to UTF-8 hex encoding
' ============================================================
Private Function StringToUtf8Hex(ByVal s As String) As String
    Dim result As String
    Dim i As Long
    Dim c As Long
    
    result = ""
    For i = 1 To Len(s)
        c = AscW(Mid(s, i, 1))
        
        ' Handle negative values (VBA returns signed)
        If c < 0 Then c = c + 65536
        
        ' Encode as UTF-8 bytes, then to hex
        If c < 128 Then
            ' ASCII: 1 byte
            result = result & Right("0" & Hex(c), 2)
        ElseIf c < 2048 Then
            ' 2 bytes: 110xxxxx 10xxxxxx
            result = result & Right("0" & Hex(192 + Int(c / 64)), 2)
            result = result & Right("0" & Hex(128 + (c Mod 64)), 2)
        ElseIf c < 65536 Then
            ' 3 bytes: 1110xxxx 10xxxxxx 10xxxxxx
            result = result & Right("0" & Hex(224 + Int(c / 4096)), 2)
            result = result & Right("0" & Hex(128 + (Int(c / 64) Mod 64)), 2)
            result = result & Right("0" & Hex(128 + (c Mod 64)), 2)
        End If
    Next i
    
    StringToUtf8Hex = result
End Function

' ============================================================
' HELPER: Parse Polish price string to cents
' ============================================================
Private Function ParsePriceToCents(priceStr As String) As Long
    Dim cleaned As String
    Dim val As Double
    
    If Len(priceStr) = 0 Then
        ParsePriceToCents = 0
        Exit Function
    End If
    
    ' Remove currency symbols and whitespace
    cleaned = priceStr
    cleaned = Replace(cleaned, "zł", "")
    cleaned = Replace(cleaned, "PLN", "")
    cleaned = Replace(cleaned, " ", "")
    cleaned = Replace(cleaned, Chr(160), "")  ' Non-breaking space
    cleaned = Replace(cleaned, ",", ".")
    cleaned = Trim(cleaned)
    
    On Error Resume Next
    val = CDbl(cleaned)
    On Error GoTo 0
    
    ParsePriceToCents = CLng(val * 100)
End Function

' ============================================================
' HELPER: Parse Polish decimal string
' ============================================================
Private Function ParseDecimal(s As String) As Double
    Dim cleaned As String
    
    If Len(s) = 0 Then
        ParseDecimal = 0
        Exit Function
    End If
    
    cleaned = Replace(Trim(s), ",", ".")
    
    On Error Resume Next
    ParseDecimal = CDbl(cleaned)
    On Error GoTo 0
End Function

' ============================================================
' HELPER: Format decimal for JSON
' ============================================================
Private Function FormatDecimal(d As Double) As String
    FormatDecimal = Replace(CStr(d), ",", ".")
End Function

' ============================================================
' HELPER: Safe string conversion
' ============================================================
Private Function SafeString(v As Variant) As String
    On Error Resume Next
    If IsNull(v) Or IsEmpty(v) Or IsError(v) Then
        SafeString = ""
    Else
        SafeString = Trim(CStr(v))
    End If
    On Error GoTo 0
End Function

' ============================================================
' HELPER: JSON string with escaping
' ============================================================
Private Function JsonString(s As String) As String
    Dim result As String
    result = s
    result = Replace(result, "\", "\\")
    result = Replace(result, """", "\""")
    result = Replace(result, vbCr, "\n")
    result = Replace(result, vbLf, "\n")
    result = Replace(result, vbTab, "\t")
    JsonString = """" & result & """"
End Function

' ============================================================
' HELPER: JSON nullable string
' ============================================================
Private Function JsonNullableString(s As String) As String
    If Len(s) = 0 Then
        JsonNullableString = "null"
    Else
        JsonNullableString = JsonString(s)
    End If
End Function

' ============================================================
' HELPER: Get last row with data
' ============================================================
Private Function GetLastRow(ws As Worksheet, col As Long) As Long
    On Error Resume Next
    GetLastRow = ws.Cells(ws.Rows.Count, col).End(xlUp).row
    If GetLastRow < 1 Then GetLastRow = 1
    On Error GoTo 0
End Function

' ============================================================
' HELPER: Check if product/model matches
' ============================================================
Private Function MatchesProductModel(product As String, model As String, _
                                      rowProduct As String, rowModel As String) As Boolean
    If LCase(Trim(product)) <> LCase(Trim(rowProduct)) Then
        MatchesProductModel = False
        Exit Function
    End If
    
    ' Model matching: both empty, or both equal
    If Len(model) = 0 And Len(rowModel) = 0 Then
        MatchesProductModel = True
    ElseIf Len(model) = 0 Or Len(rowModel) = 0 Then
        MatchesProductModel = True  ' Allow matching if one is empty
    Else
        MatchesProductModel = (LCase(Trim(model)) = LCase(Trim(rowModel)))
    End If
End Function

' ============================================================
' HELPER: Check if value looks suspicious (error, number only)
' ============================================================
Private Function IsSuspiciousValue(val As String) As Boolean
    Dim t As String
    t = Trim(val)
    
    If Len(t) = 0 Then
        IsSuspiciousValue = True
        Exit Function
    End If
    
    ' Check for Excel errors
    If InStr(t, "#REF!") > 0 Or InStr(t, "#VALUE!") > 0 Or _
       InStr(t, "#NAME?") > 0 Or InStr(t, "#DIV/0!") > 0 Or _
       InStr(t, "#N/A") > 0 Then
        IsSuspiciousValue = True
        Exit Function
    End If
    
    IsSuspiciousValue = False
End Function

' ============================================================
' TEST: Connection test
' ============================================================
Public Sub TestConnection()
    Dim result As String
    result = AppleScriptTask("AudiofastSync.scpt", "testConnection", "Test from VBA")
    MsgBox "Connection test result:" & vbCrLf & vbCrLf & result, vbInformation, "Audiofast Sync"
End Sub

' ============================================================
' TEST: Test with sample data
' ============================================================
Public Sub TestWithSampleData()
    Dim testJson As String
    Dim hexJson As String
    Dim param As String
    Dim result As String
    Dim password As String
    
    password = GetPassword()
    If Len(password) < 8 Then
        MsgBox "Missing password in Ustawienia sheet (cell B1)", vbCritical
        Exit Sub
    End If
    
    ' Simple test payload with Polish characters
    testJson = "{""mode"": ""merge"", ""variants"": [{" & _
               """price_key"": ""test/vba-sync-test"", " & _
               """brand"": ""Test"", " & _
               """product"": ""D" & ChrW(322) & "ugo" & ChrW(347) & ChrW(263) & " Test"", " & _
               """model"": null, " & _
               """base_price_cents"": 12345, " & _
               """currency"": ""PLN"", " & _
               """groups"": []}]}"
    
    hexJson = StringToUtf8Hex(testJson)
    param = ENDPOINT & "|||" & ANON_KEY & "|||" & password & "|||" & hexJson
    
    result = AppleScriptTask("AudiofastSync.scpt", "syncPricing", param)
    
    MsgBox "Test Response:" & vbCrLf & vbCrLf & Left(result, 600), vbInformation, "Audiofast Sync Test"
End Sub
