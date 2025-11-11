Option Explicit

' CONFIG
Private Const SUPABASE_URL As String = "https://xuwapsacaymdemmvblak.supabase.co"
Private Const EDGE_URL As String = SUPABASE_URL & "/functions/v1/pricing-ingest"
Private Const ANON_KEY As String = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1d2Fwc2FjYXltZGVtbXZibGFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTg3ODYsImV4cCI6MjA3MjM5NDc4Nn0.qMH2oXCcutbLFdg-IBgJkyfjhq2mQftEUBYfr8e8s2Y"
Private Const EXCEL_TOKEN As String = "4848e0fa9bbf4a3b7dfe1b6fcc8c13c4874afde71746a2e7f75f657838f551cb"
Private Const PUBLISH_MODE As String = "replace"

' SHEET NAMES (ASCII; diacritics matched at runtime)
Private Const SHEET_PRODUCTS As String = "Produkty"
Private Const SHEET_OPTIONS  As String = "Opcje"
Private Const SHEET_NUMERIC  As String = "Pod-opcje wartosci"
Private Const SHEET_LIST_CHILD As String = "Pod-opcje listy"

' Entry point for fire-and-forget async sending with UTF-8 support
Public Sub PublishPrices_SendJsonAsync()
  Dim payload As String: payload = BuildPayloadJson()
  If Len(payload) = 0 Then
    MsgBox "Brak danych do wyslania. Sprawdz nazwy arkuszy i naglowki.", vbExclamation
    Exit Sub
  End If
  
  Randomize
  Dim corrId$: corrId = Format(Now, "yyyymmdd_HHMMSS") & "_" & CStr(Int(Rnd * 1000000))
  Dim logPath$: logPath = "/tmp/audiofast_ingest_" & corrId & ".log"
  
  ' Pass JSON directly to preserve UTF-8 encoding
  Dim param$: param = EDGE_URL & "|||" & ANON_KEY & "|||" & EXCEL_TOKEN & "|||" & payload & "|||" & corrId
  
  Dim res$
  res = AppleScriptTask("SupabasePublish.scpt", "sendJsonDirectAsync", param)
  
  Dim title$, msg$: title = "Audiofast - wynik wysylki"
  If IsVerifiedReturn(res) Then
    msg = "Urzadzenie zweryfikowane, dane wyslane do przetworzenia." & vbCrLf & _
          "ID: " & corrId & vbCrLf & _
          "Log: " & logPath
    MsgBox msg, vbInformation, title
  Else
    If Len(Trim$(res)) = 0 Then res = "Brak odpowiedzi AppleScript."
    msg = "UWAGA: urzadzenie nie zostalo zweryfikowane." & vbCrLf & _
          "Wysylka przerwana lub podpis HMAC nieutworzony." & vbCrLf & vbCrLf & _
          "Szczegoly: " & Trim$(res)
    MsgBox msg, vbExclamation, title
  End If
End Sub

Private Function BuildPayloadJson() As String
  Dim wsP As Worksheet, wsO As Worksheet, wsN As Worksheet, wsL As Worksheet
  Set wsP = FindSheetSafe(SHEET_PRODUCTS)
  Set wsO = FindSheetSafe(SHEET_OPTIONS)
  Set wsN = FindSheetSafe(SHEET_NUMERIC)
  Set wsL = FindSheetSafe(SHEET_LIST_CHILD)
  If wsP Is Nothing Then Exit Function

  Dim cB&, cPr&, cM&, cC&, cU&
  cB = GetColSafe(wsP, "Producent")
  cPr = GetColSafe(wsP, "Produkt")
  cM = GetColSafe(wsP, "Model")
  cC = GetColSafe(wsP, "Cena")
  cU = GetColSafe(wsP, "URL")
  If cB * cPr * cC * cU = 0 Then Exit Function

  Dim out$, last&, r&
  last = LastRow(wsP)
  For r = 2 To last
    Dim brand$, prod$, model$, url$, base&
    brand = T(wsP.Cells(r, cB)): prod = T(wsP.Cells(r, cPr))
    model = T(wsP.Cells(r, cM)): url = T(wsP.Cells(r, cU))
    If prod <> "" And url <> "" Then
      base = PLN(wsP.Cells(r, cC).Value)
      Dim groups$
      groups = BuildGroupsJsonMac(prod, model, wsO, wsN, wsL)
      Dim jsonLine$
      jsonLine = "{""price_key"":""" & Js(url) & """," & _
                 """brand"":""" & Js(brand) & """," & _
                 """product"":""" & Js(prod) & """," & _
                 """model"":" & IIf(model = "", "null", """" & Js(model) & """") & "," & _
                 """base_price_cents"":" & base & "," & _
                 """groups"":[" & groups & "]}"
      Append out, jsonLine
    End If
  Next

  If out = "" Then Exit Function
  BuildPayloadJson = "{""mode"":""" & PUBLISH_MODE & """,""variants"":[" & out & "]}"
End Function

Private Function BuildGroupsJsonMac(ByVal product As String, ByVal model As String, wsO As Worksheet, wsN As Worksheet, wsL As Worksheet) As String
  Dim res$, tmp$

  ' 1) SELECT groups from Opcje (ordered; values ordered)
  If Not wsO Is Nothing Then
    Dim cP&, cM&, cG&, cV&, cD&, last&, i&
    cP = GetColSafe(wsO, "Produkt")
    cM = GetColSafe(wsO, "Model")
    cG = GetColSafe(wsO, "Opcja")
    cV = GetColSafe(wsO, "Pozycja slownikowa")
    cD = GetColSafe(wsO, "Cena")
    If cP * cG * cV > 0 Then
      last = LastRow(wsO)

      Dim groupNames As New Collection
      Dim valueLists As New Collection

      For i = 2 To last
        If PM(product, model, wsO.Cells(i, cP).Value, wsO.Cells(i, cM).Value) Then
          Dim gName$, vName$, delta&, gIdx&, vPos&
          gName = SText(wsO.Cells(i, cG).Value)
          vName = SText(wsO.Cells(i, cV).Value)
          If gName <> "" And vName <> "" Then
            delta = PLN(wsO.Cells(i, cD).Value)
            gIdx = EnsureGroupIndex(groupNames, valueLists, gName)
            vPos = valueLists(gIdx).Count
            AddValueJson valueLists, gIdx, vName, delta, vPos
          End If
        End If
      Next

      Dim idx&, key$, coll As Collection
      For idx = 1 To groupNames.Count
        key = CStr(groupNames(idx))
        Set coll = valueLists(idx)
        tmp = "{""name"":""" & Js(key) & """,""input_type"":""select"",""required"":true,""position"":" & CStr(idx - 1) & ",""values"":[" & JoinC(coll, ",") & "]}"
        Append res, tmp
      Next
    End If
  End If

  ' 2) Numeric child (Dlugosc wlasna) from Pod-opcje wartosci
  If Not wsN Is Nothing Then
    Dim cNP&, cNM&, cNG&, cNMin&, cNMax&, cNStep&, cNAdd&, lastN&, rN&
    cNP = GetColSafe(wsN, "Produkt")
    cNM = GetColSafe(wsN, "Model")
    cNG = GetColSafe(wsN, "Opcja")
    cNMin = GetColSafe(wsN, "Min")
    cNMax = GetColSafe(wsN, "Max")
    cNStep = GetColSafe(wsN, "Skok")
    cNAdd = GetColSafe(wsN, "Doplata")
    If cNP * cNG * cNMin * cNMax * cNStep * cNAdd > 0 Then
      lastN = LastRow(wsN)

      Dim parentList As New Collection
      If Not wsO Is Nothing Then
        Dim i2&, lastO&, gp&, gm&, gg&
        lastO = LastRow(wsO)
        gp = GetColSafe(wsO, "Produkt"): gm = GetColSafe(wsO, "Model"): gg = GetColSafe(wsO, "Opcja")
        For i2 = 2 To lastO
          If PM(product, model, wsO.Cells(i2, gp).Value, wsO.Cells(i2, gm).Value) Then
            EnsureInOrder parentList, SText(wsO.Cells(i2, gg).Value)
          End If
        Next
      End If

      For rN = 2 To lastN
        If PM(product, model, wsN.Cells(rN, cNP).Value, wsN.Cells(rN, cNM).Value) Then
          Dim parentGroup$, parentPos&
          parentGroup = SText(wsN.Cells(rN, cNG).Value)
          If parentGroup <> "" Then
            parentPos = FindIndex(parentList, parentGroup)
            If parentPos > 0 Then
              tmp = "{""name"":""" & Js(S_DlugoscWlasna()) & """,""parent"":{""group_name"":""" & Js(parentGroup) & """,""value_name"":""" & Js(S_DlugoscWlasna()) & """},""input_type"":""numeric_step"",""unit"":""m"",""required"":true,""position"":" & CStr(parentPos) & ",""numeric_rule"":{""min_value"":" & F(ToNumber(wsN.Cells(rN, cNMin).Value)) & ",""max_value"":" & F(ToNumber(wsN.Cells(rN, cNMax).Value)) & ",""step_value"":" & F(ToNumber(wsN.Cells(rN, cNStep).Value)) & ",""price_per_step_cents"":" & PLN(wsN.Cells(rN, cNAdd).Value) & ",""base_included_value"":1}}"
            Else
              tmp = "{""name"":""" & Js(S_DlugoscWlasna()) & """,""parent"":{""group_name"":""" & Js(parentGroup) & """,""value_name"":""" & Js(S_DlugoscWlasna()) & """},""input_type"":""numeric_step"",""unit"":""m"",""required"":true,""numeric_rule"":{""min_value"":" & F(ToNumber(wsN.Cells(rN, cNMin).Value)) & ",""max_value"":" & F(ToNumber(wsN.Cells(rN, cNMax).Value)) & ",""step_value"":" & F(ToNumber(wsN.Cells(rN, cNStep).Value)) & ",""price_per_step_cents"":" & PLN(wsN.Cells(rN, cNAdd).Value) & ",""base_included_value"":1}}"
            End If
            Append res, tmp
          End If
        End If
      Next
    End If
  End If

  ' 3) Nested select (Modul dodatkowy) from Pod-opcje listy (ordered values)
  If Not wsL Is Nothing Then
    Dim cLP&, cLM&, cLG&, cLV&, cLD&, lastL&, k&, vals As New Collection
    cLP = GetColSafe(wsL, "Produkt")
    cLM = GetColSafe(wsL, "Model")
    cLG = GetColSafe(wsL, "Opcja")
    cLV = GetColSafe(wsL, "Pozycja slownikowa")
    cLD = GetColSafe(wsL, "Doplata")
    If cLP * cLG * cLV * cLD > 0 Then
      lastL = LastRow(wsL)

      Dim parentList2 As New Collection
      Dim parentPos2&
      If Not wsO Is Nothing Then
        Dim i3&, lastO2&, gp2&, gm2&, gg2&
        lastO2 = LastRow(wsO)
        gp2 = GetColSafe(wsO, "Produkt"): gm2 = GetColSafe(wsO, "Model"): gg2 = GetColSafe(wsO, "Opcja")
        For i3 = 2 To lastO2
          If PM(product, model, wsO.Cells(i3, gp2).Value, wsO.Cells(i3, gm2).Value) Then
            EnsureInOrder parentList2, SText(wsO.Cells(i3, gg2).Value)
          End If
        Next
        parentPos2 = FindIndex(parentList2, S_Modul())
      End If

      Dim childCount&: childCount = 0
      For k = 2 To lastL
        If SText(wsL.Cells(k, cLP).Value) = product And _
           (model = "" Or SText(wsL.Cells(k, cLM).Value) = model Or SText(wsL.Cells(k, cLM).Value) = "") Then
          Dim name$, priceCents&
          name = SText(wsL.Cells(k, cLV).Value)
          If name <> "" Then
            priceCents = PLN(wsL.Cells(k, cLD).Value)
            vals.Add "{""name"":""" & Js(name) & """,""price_delta_cents"":" & CStr(priceCents) & ",""position"":" & CStr(childCount) & "}"
            childCount = childCount + 1
          End If
        End If
      Next

      If vals.Count > 0 Then
        Dim mName$, mdName$, parentVal$, gPos$
        mName = S_Modul(): mdName = S_ModulDodatkowy(): parentVal = "DAC + " & mdName
        gPos = IIf(parentPos2 > 0, CStr(parentPos2), "0")
        tmp = "{""name"":""" & Js(mdName) & """,""parent"":{""group_name"":""" & Js(mName) & """,""value_name"":""" & Js(parentVal) & """},""input_type"":""select"",""required"":true,""position"":" & gPos & ",""values"":[" & JoinC(vals, ",") & "]}"
        Append res, tmp
      End If
    End If
  End If

  BuildGroupsJsonMac = res
End Function

' ======================= HELPERS =======================

Private Function DeAccent(ByVal s As String) As String
  Dim u, a, i&
  u = Array(&H119, &HF3, &H105, &H15B, &H142, &H17C, &H17A, &H107, &H144, _
            &H118, &HD3, &H104, &H15A, &H141, &H17B, &H179, &H106, &H143)
  a = Array("e", "o", "a", "s", "l", "z", "z", "c", "n", "E", "O", "A", "S", "L", "Z", "Z", "C", "N")
  For i = LBound(u) To UBound(u)
    s = Replace(s, ChrW$(u(i)), a(i))
  Next
  DeAccent = LCase$(Trim$(s))
End Function

Private Function FindSheetSafe(nameLike As String) As Worksheet
  Dim sh As Worksheet
  For Each sh In ThisWorkbook.Worksheets
    If DeAccent(sh.name) = DeAccent(nameLike) Then Set FindSheetSafe = sh: Exit Function
  Next
End Function

Private Function GetColSafe(ws As Worksheet, header As String) As Long
  If ws Is Nothing Then Exit Function
  Dim c&, last&: last = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column
  For c = 1 To last
    If DeAccent(ws.Cells(1, c).Value) = DeAccent(header) Then GetColSafe = c: Exit Function
  Next
End Function

Private Function Js(s As String) As String
  s = Replace(s, "\", "\\")
  s = Replace(s, """", "\""")
  s = Replace(s, vbCr, "\n")
  s = Replace(s, vbLf, "\n")
  Js = s
End Function

Private Function S_DlugoscWlasna() As String
  S_DlugoscWlasna = "D" & ChrW$(&H142) & "ugo" & ChrW$(&H15B) & ChrW$(&H107) & " " & "w" & ChrW$(&H142) & "asna"
End Function
Private Function S_Modul() As String: S_Modul = "Modu" & ChrW$(&H142): End Function
Private Function S_ModulDodatkowy() As String: S_ModulDodatkowy = "Modu" & ChrW$(&H142) & " dodatkowy": End Function

Private Function SText(v As Variant) As String
  On Error Resume Next
  If IsError(v) Or IsNull(v) Or IsEmpty(v) Then
    SText = ""
  Else
    SText = Trim$(CStr(v))
  End If
  On Error GoTo 0
End Function

Private Function LastRow(ws As Worksheet) As Long: LastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row: End Function
Private Function PM(p1, m1, p2, m2) As Boolean: PM = (StrComp(T(p1), T(p2), vbTextCompare) = 0) And (T(m1) = T(m2) Or (T(m1) = "" And T(m2) = "")): End Function
Private Function T(v) As String: T = Trim$(CStr(v)): End Function

Private Function ToNumber(v As Variant) As Double
  If IsNumeric(v) Then
    ToNumber = CDbl(v)
  Else
    ToNumber = Val(Replace(T(v), ",", "."))
  End If
End Function

Private Function PLN(v) As Long: PLN = CLng(Round(ToNumber(v) * 100, 0)): End Function
Private Function F(d As Double) As String: F = Replace(Trim$(CStr(d)), ",", "."): End Function

Private Sub Append(ByRef base As String, ByVal piece As String)
  If base <> "" Then base = base & ","
  base = base & piece
End Sub

Private Function EnsureGroupIndex(ByRef names As Collection, ByRef lists As Collection, ByVal key As String) As Long
  Dim i&: For i = 1 To names.Count: If CStr(names(i)) = key Then EnsureGroupIndex = i: Exit Function
  Next
  names.Add key
  Dim c As New Collection: lists.Add c
  EnsureGroupIndex = names.Count
End Function

Private Sub AddValueJson(ByRef lists As Collection, ByVal gIdx As Long, ByVal vName As String, ByVal delta As Long, ByVal vPos As Long)
  lists(gIdx).Add "{""name"":""" & Js(vName) & """,""price_delta_cents"":" & CStr(delta) & ",""position"":" & CStr(vPos) & "}"
End Sub

Private Sub EnsureInOrder(ByRef names As Collection, ByVal key As String)
  If key = "" Then Exit Sub
  Dim i&: For i = 1 To names.Count: If CStr(names(i)) = key Then Exit Sub
  Next
  names.Add key
End Sub

Private Function FindIndex(ByRef names As Collection, ByVal key As String) As Long
  Dim i&: For i = 1 To names.Count: If CStr(names(i)) = key Then FindIndex = i: Exit Function
  Next
End Function

Private Function JoinC(col As Collection, sep As String) As String
  Dim i As Long, s As String
  For i = 1 To col.Count
    If i > 1 Then s = s & sep
    s = s & CStr(col(i))
  Next i
  JoinC = s
End Function

Private Function IsVerifiedReturn(ByVal res As String) As Boolean
  IsVerifiedReturn = (InStr(1, res, "Dane wyslane do przetworzenia", vbTextCompare) > 0)
End Function



